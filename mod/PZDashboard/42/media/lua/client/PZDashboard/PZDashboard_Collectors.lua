PZDashboard = PZDashboard or {}
PZDashboard.Collectors = {}

local safe = PZDashboard.Util.safe
local trackedVehicles = {}

local itemCategory = PZDashboard.Util.itemCategory

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
        icon = safe(function()
            local texture = item:getTex()
            return texture and texture:getName() or ""
        end, "", label .. ".icon"),
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
function PZDashboard.Collectors.vehicles(player)
    for _, tracked in pairs(trackedVehicles) do
        tracked.current = false
    end

    local vehicle = safe(function() return player:getVehicle() end, nil, "vehicles.current")
    if vehicle then
        local id = safe(function() return vehicle:getId() end, nil, "vehicles.id")
        if id ~= nil then
            local x = safe(function() return vehicle:getX() end, nil, "vehicles.x")
            local y = safe(function() return vehicle:getY() end, nil, "vehicles.y")
            local z = safe(function() return vehicle:getZ() end, nil, "vehicles.z")
            local tracked = trackedVehicles[id]

            if tracked then
                if x ~= nil then tracked.x = x end
                if y ~= nil then tracked.y = y end
                if z ~= nil then tracked.z = z end
            elseif x ~= nil and y ~= nil and z ~= nil then
                tracked = {
                    id = id,
                    name = "Vehicle",
                    x = x,
                    y = y,
                    z = z,
                    current = false,
                }
                trackedVehicles[id] = tracked
            end

            if tracked then
                local scriptName = safe(function() return vehicle:getScriptName() end, "", "vehicles.scriptName")
                if scriptName ~= "" then tracked.name = scriptName end
                tracked.current = true
            end
        end
    end

    local vehicles = {}
    for _, tracked in pairs(trackedVehicles) do
        table.insert(vehicles, tracked)
    end
    table.sort(vehicles, function(a, b) return a.id < b.id end)
    return { vehicles = vehicles }
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

-- Every reachable container in one payload: the player's own inventory, the
-- bags they carry, the crates/corpses/dropped bags within the vanilla loot
-- radius, and the ground. Identity lives in PZDashboard_Containers so that
-- the ids the dashboard sends back to moveItems resolve against exactly the
-- enumeration that produced them.
function PZDashboard.Collectors.containers(player)
    local records = PZDashboard.Containers.enumerate(player)
    local containers = {}
    for _, entry in ipairs(records) do
        table.insert(containers, {
            id = entry.id,
            kind = entry.kind,
            name = entry.name,
            type = entry.type,
            icon = entry.icon or "",
            x = entry.x,
            y = entry.y,
            z = entry.z,
            locked = entry.locked,
            weight = entry.container and safe(function() return entry.container:getCapacityWeight() end, 0, "containers.weight") or 0,
            -- getCapacity(), not getEffectiveCapacity(): this is the number the
            -- engine's own room check compares against
            -- (ISInventoryTransferAction.lua:889), so the dashboard's "no room"
            -- prediction matches the verdict the transfer will reach. The floor
            -- has no capacity at all and reports -1.
            capacity = entry.container and safe(function() return entry.container:getCapacity() end, -1, "containers.capacity") or -1,
            items = PZDashboard.Containers.itemsOf(entry, "containers.item"),
        })
    end
    -- Only the fields above ever reach the writer: an enumeration record also
    -- carries the live ItemContainer and, for the floor, a map of world
    -- objects - Java userdata that Json.Encode would turn into null.
    return { containers = containers }
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
