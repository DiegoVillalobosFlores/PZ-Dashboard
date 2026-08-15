require "PZDashboard/PZDashboard_Categories"

PZDashboard = PZDashboard or {}
PZDashboard.Options = { enabled = {}, interval = {} }

local page = PZAPI.ModOptions:create("PZDashboard", "PZ Dashboard")

page:addTitle("Running the server")
page:addDescription("Run: cd server && bun install && bun --hot src/index.ts")
page:addDescription("Then open http://localhost:3000 on your second screen. This mod only streams data; the companion server is a separate Bun app in the server/ folder.")

local function gameFolder()
    return Core.getMyDocumentFolder()
end

local function luaFolder()
    return gameFolder() .. getFileSeparator() .. "Lua" .. getFileSeparator()
end

local function notify(text)
    local modal = ISModalDialog:new(getCore():getScreenWidth() / 2 - 140, getCore():getScreenHeight() / 2 - 90, 280, 180, text, false)
    modal:initialise()
    modal:addToUIManager()
end

local function copyGameFolder()
    Clipboard.setClipboard(gameFolder())
    notify("Game folder copied to clipboard")
end

local function copyServerEnv()
    Clipboard.setClipboard("PZ_LUA_DIR=" .. luaFolder() .. "\nPORT=3000\nPZ_INSTALL_DIR=")
    notify("Server .env copied to clipboard")
end

page:addButton("copyGameFolder", "Copy game folder", "Copies the Zomboid data folder where PZDashboard_*.json and console.txt live", copyGameFolder, nil)
page:addButton("copyServerEnv", "Copy server .env", "Copies a ready-to-paste .env (PZ_LUA_DIR and PORT) for the companion server", copyServerEnv, nil)

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
