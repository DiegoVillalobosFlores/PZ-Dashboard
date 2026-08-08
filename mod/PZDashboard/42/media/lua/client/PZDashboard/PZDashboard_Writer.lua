local Json = require "Json"

PZDashboard = PZDashboard or {}
PZDashboard.Writer = {}

local FILE_PREFIX = "PZDashboard_"

-- Writes one JSON snapshot file per category into <Zomboid>/Lua/, which the
-- companion Bun server watches. Each write overwrites the previous snapshot
-- (createIfNull=true, append=false) so a file always holds the latest state.
function PZDashboard.Writer.write(categoryId, data)
    local ok, err = pcall(function()
        local writer = getFileWriter(FILE_PREFIX .. categoryId .. ".json", true, false)
        writer:write(Json.Encode(data))
        writer:close()
    end)
    if not ok then
        print("[PZDashboard] failed to write category '" .. categoryId .. "': " .. tostring(err))
    end
end

return PZDashboard.Writer
