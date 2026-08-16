PZDashboard = PZDashboard or {}
PZDashboard.Collectors = {}

local safe = PZDashboard.Util.safe
local trackedVehicles = {}

local itemCategory = PZDashboard.Util.itemCategory

local function itemSnapshot(item, label)
    if not item then return nil end
    local snapshot = {
        name = safe(function() return item:getDisplayName() end, "", label .. ".name"),
        type = safe(function() return item:getFullType() end, "", label .. ".type"),
        icon = safe(function()
            local texture = item:getTex()
            return texture and texture:getName() or ""
        end, "", label .. ".icon"),
        condition = safe(function() return item:getCondition() end, -1, label .. ".condition"),
        conditionMax = safe(function() return item:getConditionMax() end, -1, label .. ".conditionMax"),
    }
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
    local climate = getClimateManager()
    local gameTime = getGameTime()
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
        hoursSurvived = safe(function() return player:getHoursSurvived() end, 0, "status.hoursSurvived"),
        panicResistance = safe(function()
            local months = math.floor(math.floor(player:getHoursSurvived() / 24) / 30)
            return 1 + math.min(months, 5)
        end, 1, "status.panicResistance"),
        pain = safe(function() return stats:get(CharacterStat.PAIN) end, 0, "status.pain"),
        hour = safe(function() return gameTime:getHour() end, 0, "status.hour"),
        minute = safe(function() return gameTime:getMinutes() end, 0, "status.minute"),
        day = safe(function() return gameTime:getDay() end, 0, "status.day"),
        month = safe(function() return gameTime:getMonth() end, 0, "status.month"),
        temperature = safe(function() return climate:getTemperature() end, 0, "status.temperature"),
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
        dirX = safe(function() return player:getForwardDirection():getX() end, 0, "map.dirX"),
        dirY = safe(function() return player:getForwardDirection():getY() end, 1, "map.dirY"),
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
                local dirX = safe(function() return player:getForwardDirection():getX() end, nil, "vehicles.dirX")
                local dirY = safe(function() return player:getForwardDirection():getY() end, nil, "vehicles.dirY")
                if dirX ~= nil and dirY ~= nil then
                    tracked.dirX = dirX
                    tracked.dirY = dirY
                end
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


-- WorldMapVisited stores one flag pair per 32x32-square "unit", 8x8 units per
-- 256-square cell: VISITED is set by walking past, KNOWN only by reading a map
-- item, so a unit counts as seen if it carries either. Only the per-unit
-- queries are exposed to Lua, so the whole grid has to be probed a unit at a
-- time; the world is ~314k units, which is far too many calls for one frame.
-- ponytail: the grid is swept in FOG_UNITS_PER_PASS slices per collector run,
-- so a remote reveal (reading a map item) can take a minute to show up. The
-- area around the player is always swept first so walking reveals immediately.
local FOG_SQUARES_PER_UNIT = 32
local FOG_UNITS_PER_CELL = 8
local FOG_UNITS_PER_PASS = 6000
local FOG_PLAYER_RADIUS_UNITS = 20
local FOG_BITS = { 1, 2, 4, 8, 16, 32, 64, 128 }

local fog = { bits = {}, cursor = 0, width = 0, height = 0, originX = 0, originY = 0, dirty = false, emitted = false }

local function fogProbe(visited, ux, uy)
    local squareX = ux * FOG_SQUARES_PER_UNIT + 16
    local squareY = uy * FOG_SQUARES_PER_UNIT + 16
    if not visited:isVisited(squareX, squareY) and not visited:isKnown(squareX, squareY) then return end

    local key = math.floor(ux / FOG_UNITS_PER_CELL) .. "," .. math.floor(uy / FOG_UNITS_PER_CELL)
    local rows = fog.bits[key]
    if not rows then
        rows = { 0, 0, 0, 0, 0, 0, 0, 0 }
        fog.bits[key] = rows
    end

    local row = uy % FOG_UNITS_PER_CELL + 1
    local bit = FOG_BITS[ux % FOG_UNITS_PER_CELL + 1]
    if rows[row] % (bit * 2) < bit then
        rows[row] = rows[row] + bit
        fog.dirty = true
    end
end

function PZDashboard.Collectors.fog(player)
    local visited = safe(function() return WorldMapVisited.getInstance() end, nil, "fog.instance")
    if not visited then return nil end

    if fog.width == 0 then
        -- WorldMapVisited keeps its own cell bounds private, but they're just
        -- the world's, so the sweep is sized off the metagrid instead.
        local grid = safe(function() return getWorld():getMetaGrid() end, nil, "fog.metaGrid")
        if not grid then return nil end
        local minCellX = safe(function() return grid:getMinX() end, 0, "fog.minX")
        local minCellY = safe(function() return grid:getMinY() end, 0, "fog.minY")
        local maxCellX = safe(function() return grid:getMaxX() end, -1, "fog.maxX")
        local maxCellY = safe(function() return grid:getMaxY() end, -1, "fog.maxY")
        fog.originX = minCellX * FOG_UNITS_PER_CELL
        fog.originY = minCellY * FOG_UNITS_PER_CELL
        fog.width = (maxCellX - minCellX + 1) * FOG_UNITS_PER_CELL
        fog.height = (maxCellY - minCellY + 1) * FOG_UNITS_PER_CELL
        if fog.width <= 0 or fog.height <= 0 then
            fog.width = 0
            return nil
        end
    end

    local playerUX = math.floor(player:getX() / FOG_SQUARES_PER_UNIT)
    local playerUY = math.floor(player:getY() / FOG_SQUARES_PER_UNIT)
    for uy = playerUY - FOG_PLAYER_RADIUS_UNITS, playerUY + FOG_PLAYER_RADIUS_UNITS do
        for ux = playerUX - FOG_PLAYER_RADIUS_UNITS, playerUX + FOG_PLAYER_RADIUS_UNITS do
            fogProbe(visited, ux, uy)
        end
    end

    local total = fog.width * fog.height
    for _ = 1, FOG_UNITS_PER_PASS do
        fogProbe(visited, fog.originX + fog.cursor % fog.width, fog.originY + math.floor(fog.cursor / fog.width))
        fog.cursor = (fog.cursor + 1) % total
    end

    if not fog.dirty and fog.emitted then return nil end
    fog.dirty = false
    fog.emitted = true

    local cells = {}
    for key, rows in pairs(fog.bits) do
        local hex = ""
        for i = 1, FOG_UNITS_PER_CELL do
            hex = hex .. string.format("%02x", rows[i])
        end
        cells[key] = hex
    end
    return { unitSquares = FOG_SQUARES_PER_UNIT, cellSquares = FOG_SQUARES_PER_UNIT * FOG_UNITS_PER_CELL, cells = cells }
end

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
            capacity = (entry.kind == "player"
                and safe(function() return player:getMaxWeight() end, -1, "containers.playerCapacity"))
                or (entry.container and safe(function() return entry.container:getCapacity() end, -1, "containers.capacity"))
                or -1,
            items = PZDashboard.Containers.itemsOf(entry, "containers.item"),
        })
    end
    return { containers = containers }
end

local MAX_PERK_LEVEL = 10

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
                passive = safe(function() return perk:isPassiv() end, false, "skills.passive"),
                level = level,
                xp = safe(function() return player:getXp():getXP(perkType) end, 0, "skills.xp"),
                xpLevelStart = safe(function() return perk:getTotalXpForLevel(level) end, 0, "skills.xpLevelStart"),
                xpLevelEnd = safe(function() return perk:getTotalXpForLevel(nextLevel) end, 0, "skills.xpLevelEnd"),
            })
        end
    end
    return { perks = perks }
end

local FIXED_TRAIT_MODIFIERS = {
    AdrenalineJunkie = {
        { label = "Panic speed", value = "+20% to +25%" },
    },
    AllThumbs = {
        { label = "Inventory transfer time", value = "+100%" },
    },
    Athletic = {
        { label = "Grapple effectiveness", value = "+25%" },
    },
    Axeman = {
        { label = "Axe chopping speed", value = "+25%" },
    },
    Brave = {
        { label = "Panic gain", value = "-70%" },
        { label = "Grapple effectiveness", value = "+10%" },
    },
    Clumsy = {
        { label = "Footstep sound radius", value = "+20%" },
    },
    Cowardly = {
        { label = "Panic gain", value = "+100%" },
        { label = "Grapple effectiveness", value = "-10%" },
    },
    Crafty = {
        { label = "Crafting XP gain", value = "+30%" },
    },
    Dextrous = {
        { label = "Inventory transfer time", value = "-50%" },
    },
    Desensitized = {
        { label = "Panic gain", value = "-85%" },
        { label = "Panic after gain", value = "resets to 0" },
    },
    Deaf = {
        { label = "Perception radius", value = "2 tiles" },
    },
    Emaciated = {
        { label = "Starting weight", value = "50 kg" },
        { label = "Grapple effectiveness", value = "-40%" },
    },
    FastLearner = {
        { label = "Skill XP gain", value = "+30% except Strength/Fitness" },
    },
    FastReader = {
        { label = "Reading time", value = "-30%" },
    },
    Graceful = {
        { label = "Footstep sound radius", value = "-40%" },
    },
    HardOfHearing = {
        { label = "Perception radius", value = "-1 tile" },
    },
    HeartyAppetite = {
        { label = "Hunger increase", value = "+50%" },
    },
    HighThirst = {
        { label = "Thirst increase", value = "+100%" },
    },
    KeenHearing = {
        { label = "Perception radius", value = "+3 tiles" },
    },
    LightEater = {
        { label = "Hunger increase", value = "-25%" },
    },
    LowThirst = {
        { label = "Thirst increase", value = "-50%" },
    },
    NeedsLessSleep = {
        { label = "Fatigue increase", value = "-30%" },
    },
    NeedsMoreSleep = {
        { label = "Fatigue increase", value = "+30%" },
    },
    Obese = {
        { label = "Starting weight", value = "105 kg" },
        { label = "Grapple effectiveness", value = "+5%" },
    },
    Outdoorsman = {
        { label = "Tree clothing defense", value = "+50 points" },
    },
    Overweight = {
        { label = "Starting weight", value = "95 kg" },
        { label = "Grapple effectiveness", value = "+10%" },
    },
    Pacifist = {
        { label = "Combat XP gain", value = "-25%" },
    },
    SlowLearner = {
        { label = "Skill XP gain", value = "-30% except Strength/Fitness" },
    },
    SlowReader = {
        { label = "Reading time", value = "+30%" },
    },
    SpeedDemon = {
        { label = "Grapple effectiveness", value = "+15%" },
    },
    Strong = {
        { label = "Grapple effectiveness", value = "+25%" },
    },
    ThickSkinned = {
        { label = "Zombie injury protection", value = "x1.3" },
        { label = "Tree clothing damage chance", value = "+7 points" },
    },
    ThinSkinned = {
        { label = "Zombie injury protection", value = "x0.77" },
        { label = "Tree clothing damage chance", value = "-3 points" },
    },
    Underweight = {
        { label = "Starting weight", value = "70 kg" },
    },
    VeryUnderweight = {
        { label = "Starting weight", value = "60 kg" },
        { label = "Grapple effectiveness", value = "-20%" },
    },
}

local function signedValue(value)
    if value > 0 then return "+" .. tostring(value) end
    return tostring(value)
end

local function traitModifiers(traitName)
    local modifiers = {}
    local fixed = FIXED_TRAIT_MODIFIERS[traitName]
    if fixed then
        for _, modifier in ipairs(fixed) do
            table.insert(modifiers, modifier)
        end
    else
        local normalizedName = string.lower(traitName)
        for name, entries in pairs(FIXED_TRAIT_MODIFIERS) do
            if string.lower(name) == normalizedName then
                for _, modifier in ipairs(entries) do
                    table.insert(modifiers, modifier)
                end
                break
            end
        end
    end

    local forageDefinition
    if forageSystem and forageSystem.forageSkillDefinitions then
        local normalizedName = string.lower(traitName)
        for name, definition in pairs(forageSystem.forageSkillDefinitions) do
            if string.lower(tostring(name)) == normalizedName then
                forageDefinition = definition
                break
            end
        end
    end
    if forageDefinition then
        local visionBonus = forageDefinition.visionBonus or 0
        if visionBonus ~= 0 then
            table.insert(modifiers, { label = "Foraging vision", value = signedValue(visionBonus) .. " squares" })
        end
        local weatherEffect = forageDefinition.weatherEffect or 0
        if weatherEffect ~= 0 then
            table.insert(modifiers, { label = "Foraging weather reduction", value = signedValue(weatherEffect) .. "%" })
        end
        local darknessEffect = forageDefinition.darknessEffect or 0
        if darknessEffect ~= 0 then
            table.insert(modifiers, { label = "Foraging darkness reduction", value = signedValue(darknessEffect) .. "%" })
        end
        local specialisations = forageDefinition.specialisations
        if specialisations then
            for category, bonus in pairs(specialisations) do
                if bonus ~= 0 then
                    table.insert(modifiers, {
                        label = "Foraging " .. tostring(category),
                        value = signedValue(bonus) .. "%",
                    })
                end
            end
        end
    end

    table.sort(modifiers, function(a, b) return a.label < b.label end)
    return modifiers
end

function PZDashboard.Collectors.traits(player)
    local traits = {}
    local knownTraits = safe(function() return player:getCharacterTraits():getKnownTraits() end, nil, "traits.knownTraits")
    if not knownTraits then return { traits = traits } end

    local count = safe(function() return knownTraits:size() end, 0, "traits.count")
    for i = 0, count - 1 do
        local traitType = safe(function() return knownTraits:get(i) end, nil, "traits.type")
        if traitType then
            local id = safe(function() return traitType:getName() end, "", "traits.id")
            local trait = safe(function()
                return CharacterTraitDefinition.getCharacterTraitDefinition(traitType)
            end, nil, "traits.definition")
            local xpBoosts = {}
            local boostMap = trait and safe(function() return trait:getXpBoosts() end, nil, "traits.xpBoosts") or nil
            if boostMap then
                local boostTable = safe(function() return transformIntoKahluaTable(boostMap) end, {}, "traits.xpBoostTable")
                for perk, level in pairs(boostTable) do
                    table.insert(xpBoosts, {
                        perk = safe(function() return perk:toString() end, "", "traits.xpBoost.perk"),
                        perkName = safe(function() return PerkFactory.getPerkName(perk) end, "", "traits.xpBoost.perkName"),
                        level = safe(function() return level:intValue() end, 0, "traits.xpBoost.level"),
                    })
                end
            end

            local icon = ""
            if trait then
                icon = safe(function()
                    local texture = trait:getTexture()
                    if not texture then return "" end
                    local name = texture:getName()
                    if not name then return "" end
                    name = tostring(name):match("([^/\\]+)$") or tostring(name)
                    return name:gsub("%.png$", "")
                end, "", "traits.icon")
            end

            table.insert(traits, {
                id = safe(function() return traitType:getName() end, "", "traits.id"),
                label = trait and safe(function() return trait:getLabel() end, "", "traits.label") or "",
                description = trait and safe(function() return trait:getDescription() end, "", "traits.description") or "",
                cost = trait and safe(function() return trait:getCost() end, 0, "traits.cost") or 0,
                profession = trait and safe(function() return trait:isFree() end, false, "traits.profession") or false,
                icon = icon,
                xpBoosts = xpBoosts,
                modifiers = traitModifiers(id),
            })
        end
    end
    return { traits = traits }
end

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
                local hasModel = safe(function() return clothingItem:hasModel() end, false, "appearance.hasModel")
                local itemVisual = safe(function() return item:getVisual() end, nil, "appearance.itemVisual")
                table.insert(appearance.worn, {
                    clothingItem = safe(function() return item:getClothingItemName() end, "", "appearance.clothingItemName"),
                    name = safe(function() return item:getDisplayName() end, "", "appearance.name"),
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
