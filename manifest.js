module.exports = {
  "config": {
    "validation": {
      "schema": {
        "type": "object",
        "properties": {
          "zipLevel": {
            "type": "number"
          },
          "stopOnError": {
            "type": "boolean"
          },
          "skipOnError": {
            "type": "boolean"
          },
          "letterCase": {
            "type": "string",
            "enum": [ "lower", "upper", "ignore" ]
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
