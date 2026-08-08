PZDashboard = PZDashboard or {}
PZDashboard.Collectors = {}

-- Runs fn and returns its result, or `default` if fn errors. Used per-field
-- (rather than wrapping the whole collector) so one renamed/missing getter
-- degrades a single field instead of losing the entire category snapshot.
-- Prints the real pcall error message (label identifies which getter) since
-- the engine's own exception dump for these doesn't include one.
local function safe(fn, default, label)
    local ok, result = pcall(fn)
    if ok then
        if result == nil then return default end
        return result
    end
    print("[PZDashboard] " .. tostring(label) .. " failed: " .. tostring(result))
    return default
end

-- The category the game itself files an item under in its inventory window:
-- the DisplayCategory from the item script when it sets one, falling back to
-- the engine's own getCategory(), then run through the same IGUI_ItemCat_*
-- translation keys the vanilla pane uses (ISInventoryPane.lua ~L2530, and
-- the identical `getDisplayCategory() or getCategory()` pair at ~L2160).
-- Returns both the raw id and the player-facing label: the id is a stable
-- grouping key across languages, the label is what the dashboard prints.
-- getTextOrNull rather than getText so a category with no translation shows
-- its id instead of a raw "IGUI_ItemCat_..." key.
local function itemCategory(item, label)
    local raw = safe(function() return item:getDisplayCategory() end, nil, label .. ".displayCategory")
    if not raw or raw == "" then
        raw = safe(function() return item:getCategory() end, "", label .. ".category")
    end
    if raw == "" then return "", "" end
    return raw, (getTextOrNull("IGUI_ItemCat_" .. raw) or raw)
end

-- One shape for every item the dashboard shows in an equipment slot - hand
-- items, hotbar attachments and worn clothing all go through this, so the
-- UI can render all three with a single tile component instead of three
-- payloads that drift apart. Returns nil for an empty slot.
local function itemSnapshot(item, label)
    if not item then return nil end
    local snapshot = {
        name = safe(function() return item:getDisplayName() end, "", label .. ".name"),
        type = safe(function() return item:getFullType() end, "", label .. ".type"),
        -- Same lookup as inventory.item.icon - see the comment there.
        icon = safe(function() return item:getTex():getName() end, "", label .. ".icon"),
        condition = safe(function() return item:getCondition() end, -1, label .. ".condition"),
        -- Varies per item (a knife's 10 isn't a shirt's 40), so the raw
        -- condition is only meaningful next to its own max.
        conditionMax = safe(function() return item:getConditionMax() end, -1, label .. ".conditionMax"),
    }
    -- getCurrentAmmoCount/getMaxAmmo live on HandWeapon and are meaningless
    -- on anything that isn't a firearm, so gate on isRanged() rather than
    -- letting safe() swallow an error per tick for every melee weapon.
    local ranged = safe(function()
        return instanceof(item, "HandWeapon") and item:isRanged()
    end, false, label .. ".ranged")
    if ranged then
        snapshot.ammo = safe(function() return item:getCurrentAmmoCount() end, 0, label .. ".ammo")
        snapshot.ammoMax = safe(function() return item:getMaxAmmo() end, 0, label .. ".ammoMax")
    end
    return snapshot
end

function PZDashboard.Collectors.status(player)
    local stats = player:getStats()
    local bodyDamage = player:getBodyDamage()
    return {
        forename = safe(function() return player:getDescriptor():getForename() end, "", "status.forename"),
        surname = safe(function() return player:getDescriptor():getSurname() end, "", "status.surname"),
        displayName = safe(function() return player:getDisplayName() end, "", "status.displayName"),
        health = safe(function() return bodyDamage:getOverallBodyHealth() end, 100, "status.health"),
        hunger = safe(function() return stats:get(CharacterStat.HUNGER) end, 0, "status.hunger"),
        thirst = safe(function() return stats:get(CharacterStat.THIRST) end, 0, "status.thirst"),
        fatigue = safe(function() return stats:get(CharacterStat.FATIGUE) end, 0, "status.fatigue"),
        endurance = safe(function() return stats:get(CharacterStat.ENDURANCE) end, 0, "status.endurance"),
        stress = safe(function() return stats:get(CharacterStat.STRESS) end, 0, "status.stress"),
        panic = safe(function() return stats:get(CharacterStat.PANIC) end, 0, "status.panic"),
        boredom = safe(function() return stats:get(CharacterStat.BOREDOM) end, 0, "status.boredom"),
        pain = safe(function() return stats:get(CharacterStat.PAIN) end, 0, "status.pain"),
        infected = safe(function() return bodyDamage:isInfected() end, false, "status.infected"),
        bleeding = safe(function()
            local parts = bodyDamage:getBodyParts()
            for i = 0, parts:size() - 1 do
                if parts:get(i):getBleedingTime() > 0 then
                    return true
                end
            end
            return false
        end, false, "status.bleeding"),
    }
end

function PZDashboard.Collectors.map(player)
    return {
        x = safe(function() return player:getX() end, 0, "map.x"),
        y = safe(function() return player:getY() end, 0, "map.y"),
        z = safe(function() return player:getZ() end, 0, "map.z"),
        safehouse = safe(function() return SafeHouse.hasSafehouse(player) end, false, "map.safehouse"),
        inVehicle = safe(function() return player:getVehicle() ~= nil end, false, "map.inVehicle"),
    }
end

-- The world map's player-placed symbols/notes live behind UIWorldMap's Java
-- API (mapAPI:getSymbolsAPIv2()), which is only reachable through a
-- UIWorldMap instance - there's no standalone accessor. Rather than pulling
-- in the whole ISWorldMap UI (buttons, tabs, etc.) just to reach that API,
-- this builds the same bare, never-shown handle the vanilla client itself
-- uses for headless map queries (see ISWorldMap.lua's getStashMapBounds:
-- `local ui = {}; ui.javaObject = UIWorldMap.new(ui)`). It's created once
-- and cached, since it's never added to the UIManager and so never renders
-- or receives input.
local annotationsMapUI = nil

local function getAnnotationsSymbolsAPI()
    if not annotationsMapUI then
        local ui = {}
        ui.javaObject = UIWorldMap.new(ui)
        ui.mapAPI = ui.javaObject:getAPIv3()
        ui.mapAPI:setMapItem(MapItem.getSingleton())
        ui.mapAPI:getSymbolsAPIv2():initDefaultAnnotations()
        annotationsMapUI = ui
    end
    return annotationsMapUI.mapAPI:getSymbolsAPIv2()
end

-- Reports only the player's own hand-placed markers/notes (symbol:isUserDefined()),
-- not the map's built-in default annotations (town/POI labels baked into
-- worldmap-annotations.lua and loaded by initDefaultAnnotations - those
-- would just duplicate the base map render).
function PZDashboard.Collectors.annotations(player)
    local symbolsAPI = safe(getAnnotationsSymbolsAPI, nil, "annotations.symbolsAPI")
    local markers = {}
    if symbolsAPI then
        local count = safe(function() return symbolsAPI:getSymbolCount() end, 0, "annotations.count")
        for i = 0, count - 1 do
            local symbol = safe(function() return symbolsAPI:getSymbolByIndex(i) end, nil, "annotations.symbol")
            local userDefined = symbol and safe(function() return symbol:isUserDefined() end, false, "annotations.userDefined")
            if symbol and userDefined then
                local isText = safe(function() return symbol:isText() end, false, "annotations.isText")
                table.insert(markers, {
                    x = safe(function() return symbol:getWorldX() end, 0, "annotations.x"),
                    y = safe(function() return symbol:getWorldY() end, 0, "annotations.y"),
                    isText = isText,
                    text = isText and safe(function()
                        return symbol:getUntranslatedText() or symbol:getTranslatedText()
                    end, "", "annotations.text") or nil,
                    symbolId = (not isText) and safe(function() return symbol:getSymbolID() end, "", "annotations.symbolId") or nil,
                    r = safe(function() return symbol:getRed() end, 0, "annotations.r"),
                    g = safe(function() return symbol:getGreen() end, 0, "annotations.g"),
                    b = safe(function() return symbol:getBlue() end, 0, "annotations.b"),
                    rotation = safe(function() return symbol:getRotation() end, 0, "annotations.rotation"),
                    author = safe(function() return symbol:getAuthor() end, "", "annotations.author"),
                })
            end
        end
    end
    return { markers = markers }
end

function PZDashboard.Collectors.inventory(player)
    local inv = player:getInventory()
    local itemList = inv:getItems()
    local items = {}
    for i = 0, itemList:size() - 1 do
        local item = itemList:get(i)
        local displayCategory, categoryLabel = itemCategory(item, "inventory.item")
        table.insert(items, {
            name = safe(function() return item:getDisplayName() end, "", "inventory.item.name"),
            type = safe(function() return item:getFullType() end, "", "inventory.item.type"),
            count = safe(function() return item:getCount() end, 1, "inventory.item.count"),
            condition = safe(function() return item:getCondition() end, -1, "inventory.item.condition"),
            -- Condition only means anything next to the item's own max (a
            -- knife tops out at 10, a shirt at 40) - the equip drawers grade
            -- items by the ratio of the two.
            conditionMax = safe(function() return item:getConditionMax() end, -1, "inventory.item.conditionMax"),
            weight = safe(function() return item:getActualWeight() end, 0, "inventory.item.weight"),
            -- Matches ISInventoryPane.lua's own icon lookup (item:getTex()) so
            -- the name lines up with the "Item_*" subtexture names baked into
            -- media/texturepacks/UI.pack / UI2.pack.
            icon = safe(function() return item:getTex():getName() end, "", "inventory.item.icon"),
            -- "Weapon"/"Clothing"/"Item"/... - lets the dashboard's equip
            -- drawers offer only items that can go in the slot being filled.
            -- Deliberately the engine category and not the display one below:
            -- this is a behavioral filter, so it wants the coarse, stable
            -- bucket rather than the finer one item scripts can retitle.
            category = safe(function() return item:getCategory() end, "", "inventory.item.category"),
            -- What the game's own inventory window files this item under -
            -- the dashboard groups its item lists by it. See itemCategory().
            displayCategory = displayCategory,
            categoryLabel = categoryLabel,
            -- Empty for anything that isn't clothing; for clothing it's the
            -- ItemBodyLocation this item would occupy if worn, which is how
            -- the equipment drawer knows a hat belongs to the head slot.
            bodyLocation = safe(function() return item:getBodyLocation() end, "", "inventory.item.bodyLocation"),
        })
    end
    return {
        weight = safe(function() return inv:getCapacityWeight() end, 0, "inventory.weight"),
        capacity = safe(function() return inv:getCapacity() end, 0, "inventory.capacity"),
        items = items,
    }
end

-- Matches the vanilla auto-loot window's range (ISInventoryPage.lua): the
-- 3x3 block of squares centered on the player, same z-level only.
local NEARBY_CONTAINER_RADIUS = 1

local function nearbyContainerItems(container)
    local items = {}
    local itemList = safe(function() return container:getItems() end, nil, "nearbyContainers.container.items")
    if not itemList then return items end
    for i = 0, itemList:size() - 1 do
        local item = itemList:get(i)
        local displayCategory, categoryLabel = itemCategory(item, "nearbyContainers.item")
        table.insert(items, {
            name = safe(function() return item:getDisplayName() end, "", "nearbyContainers.item.name"),
            type = safe(function() return item:getFullType() end, "", "nearbyContainers.item.type"),
            count = safe(function() return item:getCount() end, 1, "nearbyContainers.item.count"),
            condition = safe(function() return item:getCondition() end, -1, "nearbyContainers.item.condition"),
            weight = safe(function() return item:getActualWeight() end, 0, "nearbyContainers.item.weight"),
            -- Same in-game category the player inventory reports, so a
            -- container's contents group the way the Inventory screen does.
            displayCategory = displayCategory,
            categoryLabel = categoryLabel,
        })
    end
    return items
end

-- Mirrors the container title lookup ISInventoryPage.lua uses for its loot
-- window buttons, so names match what the player sees in-game (falls back
-- to the raw type string for containers without an IGUI_ContainerTitle_
-- translation).
local function nearbyContainerName(container)
    -- getCustomName() reads the parent world object's mod data, so it throws
    -- an NPE on a container that has no parent - which is exactly what a bag
    -- dropped on the floor is, its container being backed by an item instead.
    -- Vanilla sidesteps this the same way: it only calls getCustomName() on
    -- the getObjects() containers (ISInventoryPage.lua ~L1740) and names
    -- item-backed ones after the item itself (~L1701).
    local item = safe(function() return container:getContainingItem() end, nil, "nearbyContainers.container.containingItem")
    if item then
        local itemName = safe(function() return item:getName() end, "", "nearbyContainers.container.itemName")
        if itemName ~= "" then return itemName end
    elseif safe(function() return container:getParent() ~= nil end, false, "nearbyContainers.container.parent") then
        local custom = safe(function() return container:getCustomName() end, nil, "nearbyContainers.container.customName")
        if custom and custom ~= "" then return custom end
    end
    local containerType = safe(function() return container:getType() end, "", "nearbyContainers.container.type")
    local translated = getTextOrNull("IGUI_ContainerTitle_" .. containerType)
    return translated or containerType
end

local function describeNearbyContainer(container, kind, square, locked)
    return {
        kind = kind,
        type = safe(function() return container:getType() end, "", "nearbyContainers.container.type"),
        name = nearbyContainerName(container),
        x = safe(function() return square:getX() end, 0, "nearbyContainers.container.x"),
        y = safe(function() return square:getY() end, 0, "nearbyContainers.container.y"),
        z = safe(function() return square:getZ() end, 0, "nearbyContainers.container.z"),
        locked = locked or false,
        weight = safe(function() return container:getCapacityWeight() end, 0, "nearbyContainers.container.weight"),
        capacity = safe(function() return container:getCapacity() end, 0, "nearbyContainers.container.capacity"),
        items = nearbyContainerItems(container),
    }
end

-- Scans the 3x3 squares around the player the same way the vanilla loot
-- window does (ISInventoryPage.lua ~L1630-1750): dead bodies/other
-- static-moving objects via getContainer(), world objects (fridges,
-- crates, lockers - anything with getContainerCount() > 0) via
-- getContainerByIndex(), and bags dropped on the floor via
-- getWorldObjects(). Reuses the same canReachTo() line-of-sight check so
-- containers on the far side of a wall aren't listed as reachable.
function PZDashboard.Collectors.nearbyContainers(player)
    local containers = {}
    local px = safe(function() return player:getX() end, 0, "nearbyContainers.player.x")
    local py = safe(function() return player:getY() end, 0, "nearbyContainers.player.y")
    local pz = safe(function() return player:getZ() end, 0, "nearbyContainers.player.z")
    local cell = getCell()
    local currentSq = safe(function() return player:getCurrentSquare() end, nil, "nearbyContainers.player.currentSquare")

    for dy = -NEARBY_CONTAINER_RADIUS, NEARBY_CONTAINER_RADIUS do
        for dx = -NEARBY_CONTAINER_RADIUS, NEARBY_CONTAINER_RADIUS do
            local square = safe(function() return cell:getGridSquare(px + dx, py + dy, pz) end, nil, "nearbyContainers.square")
            local reachable = square and (square == currentSq or not currentSq or currentSq:canReachTo(square))
            if reachable then
                local staticMoving = safe(function() return square:getStaticMovingObjects() end, nil, "nearbyContainers.staticMovingObjects")
                if staticMoving then
                    for i = 0, staticMoving:size() - 1 do
                        local so = staticMoving:get(i)
                        local container = safe(function() return so:getContainer() end, nil, "nearbyContainers.staticMoving.container")
                        if container then
                            local isDeadBody = safe(function() return instanceof(so, "IsoDeadBody") end, false, "nearbyContainers.staticMoving.isDeadBody")
                            table.insert(containers, describeNearbyContainer(container, isDeadBody and "deadBody" or "object", square, false))
                        end
                    end
                end

                local objects = safe(function() return square:getObjects() end, nil, "nearbyContainers.objects")
                if objects then
                    for i = 0, objects:size() - 1 do
                        local obj = objects:get(i)
                        local containerCount = safe(function() return obj:getContainerCount() end, 0, "nearbyContainers.object.containerCount")
                        if containerCount and containerCount > 0 then
                            local locked = safe(function() return instanceof(obj, "IsoThumpable") and obj:isLockedToCharacter(player) end, false, "nearbyContainers.object.locked")
                            for ci = 0, containerCount - 1 do
                                local container = safe(function() return obj:getContainerByIndex(ci) end, nil, "nearbyContainers.object.container")
                                if container then
                                    table.insert(containers, describeNearbyContainer(container, "object", square, locked))
                                end
                            end
                        end
                    end
                end

                local worldObjects = safe(function() return square:getWorldObjects() end, nil, "nearbyContainers.worldObjects")
                if worldObjects then
                    for i = 0, worldObjects:size() - 1 do
                        local item = safe(function() return worldObjects:get(i):getItem() end, nil, "nearbyContainers.worldObject.item")
                        local category = item and safe(function() return item:getCategory() end, "", "nearbyContainers.worldObject.category")
                        if category == "Container" then
                            local container = safe(function() return item:getInventory() end, nil, "nearbyContainers.worldObject.inventory")
                            if container then
                                table.insert(containers, describeNearbyContainer(container, "floorBag", square, false))
                            end
                        end
                    end
                end
            end
        end
    end

    -- Flat merge of every nearby container's items by item type, since the
    -- dashboard's use case ("what's available near me") cares about total
    -- availability more than which specific container holds it.
    local combinedByType = {}
    local combined = {}
    for _, container in ipairs(containers) do
        for _, item in ipairs(container.items) do
            local entry = combinedByType[item.type]
            if not entry then
                entry = {
                    type = item.type,
                    name = item.name,
                    count = 0,
                    weight = 0,
                    displayCategory = item.displayCategory,
                    categoryLabel = item.categoryLabel,
                }
                combinedByType[item.type] = entry
                table.insert(combined, entry)
            end
            entry.count = entry.count + item.count
            entry.weight = entry.weight + item.weight
        end
    end

    return { containers = containers, combined = combined }
end

-- PZ's skill ceiling; getTotalXpForLevel() has no defined answer past it.
local MAX_PERK_LEVEL = 10

-- PerkFactory.PerkList mixes the real skills in with the category rows they
-- hang under ("Combat - Melee", "Crafting", ...), and a category is exactly
-- an entry whose parent is Perks.None - the same test ISCharacterInfo.lua
-- uses to build the in-game skills tab. Drop those and tag each real skill
-- with its parent's id and name instead, so the dashboard groups skills the
-- way the game does without hardcoding a roster that Build 42 keeps adding
-- to (Carving, Masonry, Pottery, Tracking, ... didn't exist in 41).
function PZDashboard.Collectors.skills(player)
    local perks = {}
    for i = 0, PerkFactory.PerkList:size() - 1 do
        local perk = PerkFactory.PerkList:get(i)
        local perkType = perk:getType()
        local parent = safe(function() return perk:getParent() end, nil, "skills.parent")
        if parent and parent ~= Perks.None then
            local parentPerk = safe(function() return PerkFactory.getPerk(parent) end, nil, "skills.parentPerk")
            local level = safe(function() return player:getPerkLevel(perkType) end, 0, "skills.level")
            local nextLevel = math.min(level + 1, MAX_PERK_LEVEL)
            table.insert(perks, {
                id = safe(function() return perkType:toString() end, "", "skills.id"),
                name = safe(function() return perk:getName() end, "", "skills.name"),
                category = parentPerk and safe(function() return parentPerk:getType():toString() end, "", "skills.category") or "",
                categoryName = parentPerk and safe(function() return parentPerk:getName() end, "", "skills.categoryName") or "",
                -- Fitness and Strength: raised by traits and exercise rather
                -- than by earning XP, so the UI shouldn't show them creeping
                -- toward a next level the way a trainable skill does.
                passive = safe(function() return perk:isPassiv() end, false, "skills.passive"),
                level = level,
                xp = safe(function() return player:getXp():getXP(perkType) end, 0, "skills.xp"),
                -- Cumulative XP thresholds bracketing the current level, so
                -- the dashboard can show progress through it without carrying
                -- a copy of PZ's per-skill XP curve. Equal at level 10.
                xpLevelStart = safe(function() return perk:getTotalXpForLevel(level) end, 0, "skills.xpLevelStart"),
                xpLevelEnd = safe(function() return perk:getTotalXpForLevel(nextLevel) end, 0, "skills.xpLevelEnd"),
            })
        end
    end
    return { perks = perks }
end

-- Build 42 reworked hotbar/attachment slots; this is the collector most
-- likely to need adjustment against the in-game Lua IDE if slots come back
-- empty. Primary/secondary hand items are the stable part of this snapshot.
function PZDashboard.Collectors.toolbar(player)
    local attachedSlots = {}
    local attached = safe(function() return player:getAttachedItems() end, nil, "toolbar.attached")
    if attached then
        for i = 0, attached:size() - 1 do
            local slot = attached:get(i)
            local item = safe(function() return slot:getItem() end, nil, "toolbar.slot.item")
            local snapshot = itemSnapshot(item, "toolbar.slot")
            if snapshot then
                snapshot.location = safe(function() return slot:getLocation() end, "", "toolbar.slot.location")
                table.insert(attachedSlots, snapshot)
            end
        end
    end

    local primary = safe(function() return player:getPrimaryHandItem() end, nil, "toolbar.primary")
    local secondary = safe(function() return player:getSecondaryHandItem() end, nil, "toolbar.secondary")

    return {
        primary = itemSnapshot(primary, "toolbar.primary"),
        secondary = itemSnapshot(secondary, "toolbar.secondary"),
        attached = attachedSlots,
    }
end

-- Everything the player is currently wearing, tagged with the game's own
-- body-location string (ItemBodyLocation.*, e.g. "Hat"/"Jacket"/"Shoes").
-- Reported raw rather than pre-bucketed into the dashboard's seven paperdoll
-- slots: PZ has ~110 locations and deciding which one *represents* a slot
-- (jacket over t-shirt, say) is a presentation call, so that mapping lives
-- in the UI (src/web/lib/equipment.ts) where changing it doesn't need a Lua
-- reload.
function PZDashboard.Collectors.equipment(player)
    local worn = {}
    local wornItems = safe(function() return player:getWornItems() end, nil, "equipment.wornItems")
    if wornItems then
        for i = 0, wornItems:size() - 1 do
            local wornItem = wornItems:get(i)
            local item = safe(function() return wornItem:getItem() end, nil, "equipment.item")
            local snapshot = itemSnapshot(item, "equipment.item")
            if snapshot then
                snapshot.location = safe(function() return tostring(wornItem:getLocation()) end, "", "equipment.location")
                table.insert(worn, snapshot)
            end
        end
    end
    return { worn = worn }
end

-- Reports the character's appearance as ids, not paths: which ClothingItem
-- each garment is and which of its texture choices is selected, plus the
-- hair/beard style names. The server owns the translation to actual model
-- and texture files, because that means reading the game's own
-- clothingItems/*.xml and hairStyles.xml rather than reimplementing their
-- lookup rules here, where they'd have to be kept in sync by hand.
local function colorTable(color)
    if not color then return nil end
    return {
        r = safe(function() return color:getRedFloat() end, 1, "appearance.color.r"),
        g = safe(function() return color:getGreenFloat() end, 1, "appearance.color.g"),
        b = safe(function() return color:getBlueFloat() end, 1, "appearance.color.b"),
    }
end

function PZDashboard.Collectors.appearance(player)
    local visual = safe(function() return player:getHumanVisual() end, nil, "appearance.humanVisual")
    local appearance = {
        female = safe(function() return player:isFemale() end, false, "appearance.female"),
        worn = {},
    }

    if visual then
        appearance.skinTextureIndex = safe(function() return visual:getSkinTextureIndex() end, 1, "appearance.skinTextureIndex")
        -- Authoritative where it exists, letting the server skip its
        -- index-to-name guess. Deliberately a bare pcall rather than safe():
        -- on a build without the getter this is expected to fail, and safe()
        -- would print that to console.txt every single collection.
        local hasName, skinTexture = pcall(function() return visual:getSkinTexture() end)
        if hasName and type(skinTexture) == "string" and skinTexture ~= "" then
            appearance.skinTexture = skinTexture
        end
        appearance.hairModel = safe(function() return visual:getHairModel() end, "", "appearance.hairModel")
        appearance.beardModel = safe(function() return visual:getBeardModel() end, "", "appearance.beardModel")
        appearance.hairColor = colorTable(safe(function() return visual:getHairColor() end, nil, "appearance.hairColor"))
        appearance.beardColor = colorTable(safe(function() return visual:getBeardColor() end, nil, "appearance.beardColor"))
    end

    local wornItems = safe(function() return player:getWornItems() end, nil, "appearance.wornItems")
    if wornItems then
        for i = 0, wornItems:size() - 1 do
            local item = safe(function() return wornItems:get(i):getItem() end, nil, "appearance.item")
            local clothingItem = item and safe(function() return item:getClothingItem() end, nil, "appearance.clothingItem")
            if clothingItem then
                -- Mirrors CharacterCreationMain:updateClothingTextureCombo -
                -- a garment with a mesh indexes into textureChoices, a
                -- texture-only one into baseTextures. Getting this backwards
                -- silently picks the wrong colourway.
                local hasModel = safe(function() return clothingItem:hasModel() end, false, "appearance.hasModel")
                local itemVisual = safe(function() return item:getVisual() end, nil, "appearance.itemVisual")
                table.insert(appearance.worn, {
                    clothingItem = safe(function() return item:getClothingItemName() end, "", "appearance.clothingItemName"),
                    name = safe(function() return item:getDisplayName() end, "", "appearance.name"),
                    -- tostring'd because getLocation() hands back a
                    -- BodyLocation object, not a string, and the JSON encoder
                    -- writes any object it doesn't understand as null.
                    location = safe(function() return tostring(wornItems:get(i):getLocation()) end, "", "appearance.location"),
                    hasModel = hasModel,
                    textureChoice = itemVisual and safe(function() return itemVisual:getTextureChoice() end, 0, "appearance.textureChoice") or 0,
                    baseTexture = itemVisual and safe(function() return itemVisual:getBaseTexture() end, 0, "appearance.baseTexture") or 0,
                    tint = itemVisual and colorTable(safe(function() return itemVisual:getTint(clothingItem) end, nil, "appearance.tint")) or nil,
                })
            end
        end
    end

    return appearance
end

return PZDashboard.Collectors
