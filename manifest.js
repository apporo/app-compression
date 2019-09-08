module.exports = {
  "config": {
    "validation": {
      "schema": {
        "type": "object",
        "properties": {
          "compressionLevel": {
            "type": "number"
          },
          "stopOnError": {
            "type": "boolean"
          },
          "errorCodes": {
            "type": "object",
            "patternProperties": {
              "^[a-zA-Z]\\w*$": {
                "type": "object",
                "properties": {
                  "message": {
                    "type": "string"
                  },
                  "returnCode": {
                    "oneOf": [
                      {
                        "type": "number"
                      },
                      {
                        "type": "string"
                      }
                    ]
                  },
                  "statusCode": {
                    "type": "number"
                  },
                  "description": {
                    "type": "string"
                  }
                },
                "additionalProperties": false
              }
            },
            "additionalProperties": false
          },
        },
        "additionalProperties": false
      }
    }
  }
};
