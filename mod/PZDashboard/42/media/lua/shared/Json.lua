-- Minimal, dependency-free JSON encoder/decoder. PZ does not ship a built-in
-- Json module despite some modding docs implying otherwise - mods have to
-- bring their own. Decode is needed for the command channel (server ->
-- mod): the dashboard writes action requests as JSON, the mod reads them
-- back.
local Json = {}

local function escapeString(s)
    s = s:gsub('\\', '\\\\')
    s = s:gsub('"', '\\"')
    s = s:gsub('\n', '\\n')
    s = s:gsub('\r', '\\r')
    s = s:gsub('\t', '\\t')
    return s
end

local function isArray(t)
    local count = 0
    for _ in pairs(t) do count = count + 1 end
    if count == 0 then return true end
    for i = 1, count do
        if t[i] == nil then return false end
    end
    return true
end

local encodeValue

local function encodeArray(t)
    local parts = {}
    for i = 1, #t do
        parts[i] = encodeValue(t[i])
    end
    return "[" .. table.concat(parts, ",") .. "]"
end

local function encodeObject(t)
    local parts = {}
    for k, v in pairs(t) do
        table.insert(parts, '"' .. escapeString(tostring(k)) .. '":' .. encodeValue(v))
    end
    return "{" .. table.concat(parts, ",") .. "}"
end

encodeValue = function(v)
    local t = type(v)
    if t == "nil" then
        return "null"
    elseif t == "boolean" then
        return v and "true" or "false"
    elseif t == "number" then
        return tostring(v)
    elseif t == "string" then
        return '"' .. escapeString(v) .. '"'
    elseif t == "table" then
        if isArray(v) then
            return encodeArray(v)
        else
            return encodeObject(v)
        end
    end
    return "null"
end

function Json.Encode(value)
    return encodeValue(value)
end

local function skipWhitespace(s, i)
    local _, j = s:find("^%s*", i)
    return j + 1
end

local decodeValue

local function decodeString(s, i)
    local j = i + 1
    local buf = {}
    while true do
        local c = s:sub(j, j)
        if c == "" then
            error("Json.Decode: unterminated string")
        elseif c == '"' then
            return table.concat(buf), j + 1
        elseif c == "\\" then
            local esc = s:sub(j + 1, j + 1)
            if esc == "n" then buf[#buf + 1] = "\n"
            elseif esc == "t" then buf[#buf + 1] = "\t"
            elseif esc == "r" then buf[#buf + 1] = "\r"
            elseif esc == "u" then
                -- Escapes outside the mod's ASCII item types/ids aren't
                -- expected; keep this simple rather than pull in a full
                -- UTF-16 surrogate-pair decoder for a case that won't hit.
                buf[#buf + 1] = "?"
                j = j + 4
            else
                buf[#buf + 1] = esc
            end
            j = j + 2
        else
            buf[#buf + 1] = c
            j = j + 1
        end
    end
end

local function decodeNumber(s, i)
    local _, j, numStr = s:find("^(%-?%d+%.?%d*[eE]?[%+%-]?%d*)", i)
    if not numStr then error("Json.Decode: invalid number at " .. i) end
    return tonumber(numStr), j + 1
end

local function decodeArray(s, i)
    local arr = {}
    local n = 0
    i = skipWhitespace(s, i + 1)
    if s:sub(i, i) == "]" then return arr, i + 1 end
    while true do
        local value
        value, i = decodeValue(s, i)
        n = n + 1
        arr[n] = value
        i = skipWhitespace(s, i)
        local c = s:sub(i, i)
        if c == "," then
            i = skipWhitespace(s, i + 1)
        elseif c == "]" then
            return arr, i + 1
        else
            error("Json.Decode: expected ',' or ']' in array at " .. i)
        end
    end
end

local function decodeObject(s, i)
    local obj = {}
    i = skipWhitespace(s, i + 1)
    if s:sub(i, i) == "}" then return obj, i + 1 end
    while true do
        if s:sub(i, i) ~= '"' then error("Json.Decode: expected string key at " .. i) end
        local key
        key, i = decodeString(s, i)
        i = skipWhitespace(s, i)
        if s:sub(i, i) ~= ":" then error("Json.Decode: expected ':' at " .. i) end
        i = skipWhitespace(s, i + 1)
        local value
        value, i = decodeValue(s, i)
        obj[key] = value
        i = skipWhitespace(s, i)
        local c = s:sub(i, i)
        if c == "," then
            i = skipWhitespace(s, i + 1)
        elseif c == "}" then
            return obj, i + 1
        else
            error("Json.Decode: expected ',' or '}' in object at " .. i)
        end
    end
end

decodeValue = function(s, i)
    i = skipWhitespace(s, i)
    local c = s:sub(i, i)
    if c == '"' then
        return decodeString(s, i)
    elseif c == "{" then
        return decodeObject(s, i)
    elseif c == "[" then
        return decodeArray(s, i)
    elseif s:sub(i, i + 3) == "true" then
        return true, i + 4
    elseif s:sub(i, i + 4) == "false" then
        return false, i + 5
    elseif s:sub(i, i + 3) == "null" then
        return nil, i + 4
    else
        return decodeNumber(s, i)
    end
end

function Json.Decode(str)
    local value = decodeValue(str, 1)
    return value
end

return Json
