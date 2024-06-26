const {testAutherDefinition} = require('@friggframework/devtools');
const {Definition} = require('../definition');

const mocks = {
    getUserDetails: {
        "sub": "1234567890",
        "name": "John Doe",
        "email": "test@email.com"
    },
    tokenResponse: {
      "access_token": "some_access_token",
      "token_type": "bearer",
      "expires_in": 3600,
      "data": {
          "id": 1234567890,
          "gid": "1234567890",
          "name": "John Doe",
          "email": "test@email.com"
      },
      "refresh_token": "some_refresh_token",
      "id_token": "some_id_token",
    },
    authorizeResponse: {
        "base": "/redirect/asana",
        "data": {
            "code": "test-code",
            "state": "null"
        }
    }
}

testAutherDefinition(Definition, mocks)