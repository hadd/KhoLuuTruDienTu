# Public Static Module

This module serves static files from the `public-dir` folder.

## Purpose

The `public-static` module provides a router that serves static files from the `public-dir` directory, allowing clients to download templates, samples, and other public assets.

## Features

- **Dynamic file serving**: All files in `public-dir` are accessible via HTTP
- **No manual mapping**: Files are served automatically based on their path in the directory structure
- **404 handling**: Returns 404 for non-existent files
- **Elysia integration**: Uses Elysia's `file()` helper for efficient file serving

## Usage

```typescript
import { createPublicStaticRouter } from "./modules/public-static/index.ts";

// Serve files from public-dir under /api/public/
app.use(createPublicStaticRouter("/"));
```

## File Access

Files in `public-dir` are accessible at:
- `http://localhost:3000/api/public/<file-path>`

Example:
- `public-dir/samples/student-import-sample.csv` → `http://localhost:3000/api/public/samples/student-import-sample.csv`

## Directory Structure

```
public-dir/
├── samples/
│   ├── student-import-sample.csv
│   └── student-import-sample.xlsx
└── ...
```

## Implementation

The router uses a wildcard route (`.all("*")`) to capture all requests and serves the corresponding file from `public-dir`. This eliminates the need for manual path mapping and provides a clean, scalable solution for serving static assets.

