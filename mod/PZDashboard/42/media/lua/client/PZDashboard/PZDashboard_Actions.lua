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

-- Drops the first inventory item matching params.itemType (e.g.
-- "Base.Screwdriver") on the ground. Delegates to the same vanilla
-- context-menu function the in-game "Drop" option uses, rather than
-- reimplementing equip/vehicle/lit-item handling ourselves.
function PZDashboard.Actions.dropItem(player, params)
    local item = findItemByType(player, params.itemType)
    if not item then
        return false, "item not found: " .. tostring(params.itemType)
    end
    ISInventoryPaneContextMenu.dropItem(item, player:getPlayerNum())
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
