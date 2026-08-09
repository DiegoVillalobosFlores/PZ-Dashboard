require "TimedActions/ISInventoryTransferUtil"
require "PZDashboard/PZDashboard_Containers"

PZDashboard = PZDashboard or {}
PZDashboard.Actions = {}

-- The player's inventory container also holds what they're wearing and
-- carrying, so this finds equipped items too. `equipped` biases the search
-- when duplicates exist: unequipping "Base.Tshirt" has to reach the one
-- actually on the body, not an identical spare in the bag.
local function findItemByType(player, itemType, equipped)
    local items = player:getInventory():getItems()
    local fallback = nil
    for i = 0, items:size() - 1 do
        local item = items:get(i)
        if item:getFullType() == itemType then
            if not equipped then return item end
            -- Same predicate vanilla's unequipItem() guards on, so a match
            -- here is a match it will actually act on. Covers worn clothing
            -- as well as held items.
            if player:isEquipped(item) then return item end
            fallback = fallback or item
        end
    end
    return fallback
end

-- No-op used to verify the command channel round-trip without touching
-- game state.
function PZDashboard.Actions.ping(player, params)
    return true
end

-- Moves a batch of items into one container. Containers and items are both
-- addressed by the ids PZDashboard_Containers.enumerate() hands out, and this
-- re-runs that same enumeration and searches it rather than parsing an id
-- back into a square/object - so an id can only ever name a container the mod
-- itself described, and a stale one resolves to nothing instead of to the
-- wrong crate.
--
-- Everything is queued through the vanilla transfer action, one action per
-- InventoryItem: there is no bulk API, and ISInventoryTransferAction merges
-- adjacent same-source/same-destination actions back together itself.
local function moveError(message)
    return false, message
end

function PZDashboard.Actions.moveItems(player, params)
    local destinationId = params.to
    local itemIds = params.itemIds
    if type(destinationId) ~= "string" or type(itemIds) ~= "table" or #itemIds == 0 then
        return moveError("moveItems: expected { to = <containerId>, itemIds = { <n>, ... } }")
    end

    local records = PZDashboard.Containers.enumerate(player)

    local destination = nil
    for _, entry in ipairs(records) do
        if entry.id == destinationId then destination = entry break end
    end
    if not destination then
        return moveError("destination container not found: " .. destinationId)
    end
    if destination.locked then
        return moveError(destination.name .. " is locked")
    end

    -- Ids come off the wire as JSON numbers and Json.Decode yields Lua
    -- numbers, so this compares numerically - tostring() on a Kahlua double
    -- can render an integer id as "12345.0" and never match.
    local located = {}
    for _, entry in ipairs(records) do
        if entry.floorItems then
            for _, floorEntry in ipairs(entry.floorItems) do
                located[floorEntry.item:getID()] = { item = floorEntry.item, record = entry }
            end
        elseif entry.container then
            local items = entry.container:getItems()
            for i = 0, items:size() - 1 do
                local item = items:get(i)
                located[item:getID()] = { item = item, record = entry }
            end
        end
    end

    local moves = {}
    for _, itemId in ipairs(itemIds) do
        local found = located[itemId]
        if found and found.record.id ~= destination.id then
            table.insert(moves, found)
        end
    end
    if #moves == 0 then
        return moveError("none of those items are still there")
    end

    -- Same gate javaTransferItems() applies (ISInventoryTransferAction.lua:889),
    -- run against a projected weight: getCapacityWeight() will not move until
    -- the queued transfers actually complete, so checking every item against
    -- the container's current weight would wave a whole overweight batch through.
    local admitted = {}
    if destination.kind == "floor" then
        admitted = moves
    else
        local projected = destination.container:getCapacityWeight()
        local capacity = destination.container:getCapacity()
        for _, move in ipairs(moves) do
            local weight = move.item:getActualWeight()
            local allowed = destination.container:isItemAllowed(move.item)
                and not destination.container:isInside(move.item)
                and projected + weight <= capacity
            if allowed then
                projected = projected + weight
                table.insert(admitted, move)
            end
        end
        if #admitted == 0 then
            return moveError("no room in " .. destination.name)
        end
    end

    -- walkToContainer() clears the whole timed-action queue when it decides a
    -- walk is needed (luautils.lua:357), so every reachability gate has to run
    -- before the first transfer is queued or the walk would throw the transfers
    -- away. In practice both sides sit inside the 3x3 scan radius and the
    -- distance short-circuit at luautils.lua:310 returns without queuing anything.
    local playerNum = player:getPlayerNum()
    local gated = {}
    local function gate(entry)
        if gated[entry.id] or entry.kind == "floor" or entry.kind == "player" then return true end
        gated[entry.id] = true
        if not luautils.walkToContainer(entry.container, playerNum) then
            return false
        end
        return true
    end

    if not gate(destination) then
        return moveError("cannot reach " .. destination.name)
    end
    for _, move in ipairs(admitted) do
        if not gate(move.record) then
            return moveError("cannot reach " .. move.record.name)
        end
    end

    for _, move in ipairs(admitted) do
        local item = move.item
        if destination.kind == "floor" then
            ISInventoryPaneContextMenu.dropItem(item, playerNum)
        elseif move.record.kind == "floor" then
            -- Picking up off the ground forks on SP/MP exactly the way
            -- ISWorldObjectContextMenu.lua:1455-1459 does. Either way the item
            -- lands in the player's hands first; anywhere else needs a second
            -- hop, which revalidates once the grab has completed.
            if isClient() then
                ISTimedActionQueue.add(ISInventoryTransferUtil.newInventoryTransferAction(
                    player, item, item:getContainer(), player:getInventory()))
            else
                ISTimedActionQueue.add(ISGrabItemAction:new(player, move.record.worldObjects[item:getID()], 20))
            end
            if destination.id ~= "player" then
                ISTimedActionQueue.add(ISInventoryTransferUtil.newInventoryTransferAction(
                    player, item, player:getInventory(), destination.container))
            end
        else
            -- Source comes off the item, not off the enumeration record: that
            -- is what every vanilla call site passes and it cannot go stale.
            ISTimedActionQueue.add(ISInventoryTransferUtil.newInventoryTransferAction(
                player, item, item:getContainer(), destination.container))
        end
    end

    return true
end

-- Equip/wear/unequip all delegate to the same vanilla context-menu handlers
-- the in-game inventory uses, rather than calling setPrimaryHandItem() and
-- friends directly. Those handlers queue the proper timed action and carry
-- all the special-casing with them (equip animation, two-handed weapons,
-- snuffing a lit candle or hurricane lantern on unequip, transferring a
-- garment into the main inventory before wearing it) - none of which is
-- worth reimplementing here. Because they're timed actions, the result the
-- dashboard gets back is "queued ok", not "equipped"; the equipment/toolbar
-- categories report the real outcome a moment later.
local function equipHand(player, params, primary)
    local item = findItemByType(player, params.itemType)
    if not item then
        return false, "item not found: " .. tostring(params.itemType)
    end
    local handler = primary and ISInventoryPaneContextMenu.OnPrimaryWeapon
        or ISInventoryPaneContextMenu.OnSecondWeapon
    handler({ item }, player:getPlayerNum())
    return true
end

function PZDashboard.Actions.equipPrimary(player, params)
    return equipHand(player, params, true)
end

function PZDashboard.Actions.equipSecondary(player, params)
    return equipHand(player, params, false)
end

-- Wears a clothing item from the inventory. PZ decides the body location
-- from the item itself, so there's no slot parameter: wearing a hat always
-- fills the hat slot, replacing whatever was there.
function PZDashboard.Actions.wearItem(player, params)
    local item = findItemByType(player, params.itemType)
    if not item then
        return false, "item not found: " .. tostring(params.itemType)
    end
    ISInventoryPaneContextMenu.onWearItems({ item }, player:getPlayerNum())
    return true
end

-- Takes an item out of a hand or off the body. Vanilla's unequipItem() is a
-- silent no-op on an item that isn't currently equipped, so the guard here
-- is what turns a stale click from the dashboard into a reported error
-- instead of a command that looks like it succeeded and did nothing.
function PZDashboard.Actions.unequipItem(player, params)
    local item = findItemByType(player, params.itemType, true)
    if not item then
        return false, "item not found: " .. tostring(params.itemType)
    end
    if not player:isEquipped(item) then
        return false, "item not equipped: " .. tostring(params.itemType)
    end
    ISInventoryPaneContextMenu.unequipItem(item, player:getPlayerNum())
    return true
end

return PZDashboard.Actions
