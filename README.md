# Rerote

A data conversion tool built with TanStack Start, designed to convert data from various platforms to Rote format.

## Features

- **Multi-platform support**: Currently supports converting from Memos to Rote format
- **Dual input modes**:
  - API mode: Fetch data directly from platform API
  - File mode: Upload data file (JSON or SQLite) for conversion
- **Real-time feedback**: Progress indicators and detailed conversion statistics
- **User-friendly interface**: Simple and intuitive design with responsive layout
- **Internationalization**: Support for Chinese and English languages
- **Downloadable output**: Convert data to Rote format and download as JSON file

## Tech Stack

- **Framework**: TanStack Start (React + Vite)
- **Routing**: TanStack Router (file-based routing)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui + Radix UI
- **Icons**: Lucide React
- **Testing**: Vitest with Testing Library
- **Build**: Vite
- **Internationalization**: i18next

## Quick Start

### Prerequisites

- Node.js 18+
- Bun (recommended) or npm/pnpm

### Installation

```bash
# Install dependencies
bun install

# Start development server on port 4000
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Usage

1. **Select Platform**: Choose the source platform from the available options (currently Memos)
2. **Choose Input Mode**:
   - **API Mode**: Enter platform API endpoint and access token
   - **File Mode**: Upload JSON or SQLite file containing your data
3. **Start Conversion**: Click "Start Conversion" button
4. **View Results**: Monitor conversion progress and view detailed statistics
5. **Download Output**: Download the converted Rote format data file

## Project Structure

```
Rerote/
├── src/
│   ├── components/
│   │   ├── converter/       # Converter UI components
│   │   ├── ui/              # Reusable UI components (shadcn/ui)
│   │   ├── Footer.tsx       # Footer component
│   │   ├── logo.tsx         # Logo component
│   │   └── not-found.tsx    # 404 page
│   ├── lib/
│   │   ├── converters/      # Platform-specific conversion logic
│   │   │   ├── index.ts     # Converter interface and registry
│   │   │   ├── memos-to-rote.ts  # Memos to Rote converter
│   │   │   ├── memos-api.ts      # Memos API client
│   │   │   └── types.ts     # Shared types across converters
│   │   ├── i18n/            # Internationalization configuration
│   │   └── utils/           # Utility functions (file operations, etc.)
│   ├── routes/              # File-based routes
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Home page
│   │   └── converter.tsx    # Converter page
│   └── styles.css           # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Adding a New Platform

To add support for a new platform:

1. Create a new converter file in `src/lib/converters/` (e.g., `notion-to-rote.ts`)
2. Add the platform to the `Platform` enum in `src/lib/converters/index.ts`
3. Define source types for the platform in `src/lib/converters/types.ts`
4. Implement the `Converter` interface with `validate()` and `convert()` methods
5. Add the converter to the `converters` array in `src/lib/converters/index.ts`

## Development Commands

```bash
# Start dev server
bun run dev

# Build for production
bun run build

# Run tests (Vitest)
bun run test

# Run ESLint
bun run lint

# Fix ESLint errors
bun run lint:fix

# Check Prettier formatting
bun run format

# Fix Prettier formatting
bun run format:fix

# Format and fix all issues
bun run check
```

## Conversion Architecture

The converter system follows a plugin-based architecture:

1. **Converter Interface**: Each platform implements a `Converter` interface with:
   - `validate(data)`: Check if data can be processed by this converter
   - `convert(data)`: Transform data to Rote format
   - `supportedModes`: Array of supported input modes (`['file']`, `['api']`, or both)

2. **Data Flow**:
   - User selects platform and input mode
   - Converter validates input data
   - Data is transformed to Rote format
   - `ConversionResult` is produced with statistics and errors
   - Output is downloadable as JSON

## Supported Formats

### Input Formats

- **Memos**:
  - API: Direct API access
  - File: JSON export or SQLite database file (`.db`, `.sqlite`, `.sqlite3`)

### Output Format

- **Rote**: Standardized JSON format for notes and data

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## GitHub Repositories

- Rerote: [https://github.com/Rabithua/Rerote](https://github.com/Rabithua/Rerote)
- Rote: [https://github.com/Rabithua/rote](https://github.com/Rabithua/rote)
