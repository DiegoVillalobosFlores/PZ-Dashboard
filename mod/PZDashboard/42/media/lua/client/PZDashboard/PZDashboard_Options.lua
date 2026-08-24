require "PZDashboard/PZDashboard_Categories"

PZDashboard = PZDashboard or {}
PZDashboard.Options = { enabled = {}, interval = {} }

local page = PZAPI.ModOptions:create("PZDashboard", "PZ Dashboard")

local function gameFolder()
    return Core.getMyDocumentFolder()
end

local function luaFolder()
    return gameFolder() .. getFileSeparator() .. "Lua" .. getFileSeparator()
end

local function modFolder()
    local info = getModInfoByID("PZDashboard")
    return info and info:getDir() or ""
end

local function dashboardFile()
    local dir = modFolder()
    if dir == "" then return "" end
    return dir .. getFileSeparator() .. "Dashboard.html"
end

local function notify(text)
    local modal = ISModalDialog:new(getCore():getScreenWidth() / 2 - 140, getCore():getScreenHeight() / 2 - 90, 280, 180, text, false)
    modal:initialise()
    modal:addToUIManager()
end

local function copyPath(path, label, missing)
    if path == "" then
        notify(missing)
        return
    end
    Clipboard.setClipboard(path)
    notify(label .. " copied to clipboard")
end

local function copyGameFolder()
    copyPath(gameFolder(), "Game folder", "Game folder could not be found")
end

local function copyModFolder()
    copyPath(modFolder(), "Mod folder", "Mod folder could not be found")
end

local function copyDashboardFile()
    copyPath(dashboardFile(), "Dashboard.html path", "Dashboard.html is only in the Workshop copy of this mod")
end

local function copyServerEnv()
    Clipboard.setClipboard("PZ_LUA_DIR=" .. luaFolder() .. "\nPORT=3000\nPZ_INSTALL_DIR=")
    notify("Server .env copied to clipboard")
end

page:addTitle("Paths")
page:addDescription("This mod only streams game data to disk. Something has to read it: either the Dashboard.html shipped in the mod folder, or the companion server. Both ways need the game folder below.")
page:addButton("copyGameFolder", "Copy game folder", "The Zomboid data folder where PZDashboard_*.json and console.txt live", copyGameFolder, nil)
page:addButton("copyModFolder", "Copy mod folder", "The folder this mod is installed in", copyModFolder, nil)
page:addButton("copyDashboardFile", "Copy Dashboard.html path", "The dashboard itself, one self-contained file inside the mod folder", copyDashboardFile, nil)
page:addDescription("Linux: these are the paths the game sees, so they need translating. On a native build C:\\users\\steamuser\\Zomboid is ~/Zomboid. Under Proton it is <Steam>/steamapps/compatdata/108600/pfx/drive_c/users/steamuser/Zomboid, and the mod folder may instead live under steamapps/workshop/content/108600.")

page:addTitle("On this machine (browser)")
page:addDescription("Paste the Dashboard.html path into Chrome or Edge. It asks once for the game folder above - allow read and write, so the dashboard can send commands back.")
page:addDescription("The map and character screens ask separately for the Project Zomboid install folder (the one with the media folder in it). That one is read-only. Both are remembered.")
page:addDescription("On Linux your browser runs outside the game's Proton prefix, so paste the translated path from the note above instead of the C:\\ one, and pick the same folder in the picker.")

page:addTitle("On another device (server)")
page:addDescription("Run the companion Bun server on this machine, then open http://<this machine>:3000 on a phone, tablet or handheld on the same network.")
page:addDescription("Run: bun install && bun run dev in apps/server. Copy the .env below into apps/server/.env.local first, and fill PZ_INSTALL_DIR with the Project Zomboid install folder.")
page:addButton("copyServerEnv", "Copy server .env", "A ready-to-paste .env.local with PZ_LUA_DIR and PORT filled in", copyServerEnv, nil)
page:addDescription("On Linux replace the C:\\ path in PZ_LUA_DIR with the translated one from the note above - the server runs outside the Proton prefix and cannot open a Windows path.")

for _, category in ipairs(PZDashboard.Categories) do
    PZDashboard.Options.enabled[category.id] = page:addTickBox(
        category.optionName,
        "Stream " .. category.label,
        true,
        "Send " .. category.label .. " data to the dashboard server"
    )
    PZDashboard.Options.interval[category.id] = page:addSlider(
        category.intervalOption,
        category.label .. " interval (seconds)",
        0.25,
        category.maxInterval,
        0.25,
        category.defaultInterval,
        "How often " .. category.label .. " is sent - higher is lighter on performance"
    )
end

return PZDashboard.Options
