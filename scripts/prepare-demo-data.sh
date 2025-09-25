#! /bin/bash

cp -r photos ./apps/web/public/photos

echo '{
  "storage": {
    "provider": "local",
    "basePath": "./apps/web/public/photos",
    "baseUrl": "/photos"
  }
}' >builder.config.json
