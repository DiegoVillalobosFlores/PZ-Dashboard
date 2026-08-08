require "PZDashboard/PZDashboard_Categories"
require "PZDashboard/PZDashboard_Options"
require "PZDashboard/PZDashboard_Config"
require "PZDashboard/PZDashboard_Writer"
require "PZDashboard/PZDashboard_Collectors"
require "PZDashboard/PZDashboard_Reader"
require "PZDashboard/PZDashboard_Actions"

PZDashboard = PZDashboard or {}

local lastRunMs = {}
local MANIFEST_INTERVAL_MS = 1000
local lastManifestMs = 0

local COMMAND_POLL_INTERVAL_MS = 300
local lastCommandPollMs = 0
local lastCommandId = nil

-- Applies the latest command from the dashboard server at most once per
-- id, so a command file that hasn't changed since the last poll doesn't
-- re-run every interval.
local function processCommand(player)
    local command = PZDashboard.Reader.readCommand()
    if not command or command.id == lastCommandId then return end
    lastCommandId = command.id

    local handler = PZDashboard.Actions[command.action]
    if not handler then
        PZDashboard.Writer.write("commandResult", {
            id = command.id, ok = false, error = "unknown action: " .. tostring(command.action),
        })
        return
    end

    local pcallOk, resultOk, resultErr = pcall(handler, player, command.params or {})
    if not pcallOk then
        PZDashboard.Writer.write("commandResult", { id = command.id, ok = false, error = tostring(resultOk) })
    else
        PZDashboard.Writer.write("commandResult", { id = command.id, ok = resultOk, error = resultErr })
    end
end

local function tick()
    local player = getPlayer()
    if not player then return end

    local now = getTimestampMs()

    if now - lastCommandPollMs >= COMMAND_POLL_INTERVAL_MS then
        lastCommandPollMs = now
        processCommand(player)
    end

    local manifest = {}

    for _, category in ipairs(PZDashboard.Categories) do
        local enabled = PZDashboard.Config.isEnabled(category)
        manifest[category.id] = { enabled = enabled }

        if enabled then
            local intervalMs = PZDashboard.Config.getIntervalSeconds(category) * 1000
            local last = lastRunMs[category.id] or 0
            if now - last >= intervalMs then
                lastRunMs[category.id] = now
                local collector = PZDashboard.Collectors[category.id]
                local ok, data = pcall(collector, player)
                if ok then
                    PZDashboard.Writer.write(category.id, data)
                    manifest[category.id].updatedAtMs = now
                else
                    print("[PZDashboard] collector '" .. category.id .. "' failed: " .. tostring(data))
                end
            end
        end
    end

    if now - lastManifestMs >= MANIFEST_INTERVAL_MS then
        lastManifestMs = now
        PZDashboard.Writer.write("manifest", manifest)
    end
end

Events.OnTick.Add(tick)
