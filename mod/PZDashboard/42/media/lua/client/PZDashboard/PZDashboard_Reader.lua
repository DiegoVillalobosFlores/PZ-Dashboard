local Json = require "Json"

PZDashboard = PZDashboard or {}
PZDashboard.Reader = {}

local COMMAND_FILE = "PZDashboard_command.json"

-- Reads the latest command the dashboard server wrote, if any.
-- getFileReader(name, false) returns nil rather than throwing when the
-- file doesn't exist yet, which is the normal case between commands.
function PZDashboard.Reader.readCommand()
    local reader = getFileReader(COMMAND_FILE, false)
    if not reader then return nil end
    local line = reader:readLine()
    reader:close()
    if not line then return nil end

    local ok, data = pcall(Json.Decode, line)
    if not ok then
        print("[PZDashboard] failed to parse command file: " .. tostring(data))
        return nil
    end
    return data
end

return PZDashboard.Reader
