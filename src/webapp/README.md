# SET React + Shadcn Template

A modern, production-ready React template built with Vite, TypeScript, and shadcn/ui. Features clean folder structure, React Router navigation, and easy theme customization using TweakCN.

## Features

- ⚡️ **Vite** - Lightning fast build tool
- ⚛️ **React 19** - Latest React with TypeScript
- 🎨 **Shadcn/ui** - Beautiful, accessible component library
- 🎭 **TweakCN Compatible** - Easy theme customization with OKLCH colors
- 🧭 **React Router** - Full routing with nested routes
- 📁 **Clean Structure** - Organized folder structure for scalability
- 🌓 **Dark Mode** - Simple light/dark mode toggle
- 🔧 **MCP Integration** - Chrome DevTools MCP server configured

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Theme Customization

This template uses OKLCH color space for themes, compatible with [TweakCN Theme Editor](https://tweakcn.com/editor/theme).

### Changing the Theme

1. Go to [https://tweakcn.com/editor/theme](https://tweakcn.com/editor/theme)
2. Customize your colors, fonts, and styles using the visual editor
3. Copy the generated CSS (both `:root` and `.dark` sections)
4. Open `src/index.css`
5. Find the **LIGHT MODE** section (clearly marked with comments)
6. Replace everything from `:root {` to `}` with your light theme
7. Find the **DARK MODE** section (clearly marked with comments)
8. Replace everything from `.dark {` to `}` with your dark theme

That's it! The file has clear comment markers showing exactly where to paste. Your new theme will apply immediately.

### Dark Mode Toggle

A dark/light mode toggle button is available in the top-right corner of the dashboard.

## Project Structure

```
src/
├── shadcn/                    # Shadcn auto-generated code (DO NOT edit manually)
│   ├── components/            # All shadcn UI components
│   └── lib/                   # Shadcn utilities (cn function)
├── components/                # Custom shared components
│   ├── layout.tsx
│   └── mode-toggle.tsx
├── navigation/                # Navigation components
│   ├── app-sidebar.tsx
│   ├── site-header.tsx
│   ├── nav-main.tsx
│   ├── nav-projects.tsx
│   ├── nav-user.tsx
│   └── team-switcher.tsx
├── pages/                     # Page components (routes)
│   ├── Home.tsx
│   ├── Dashboard.tsx
│   ├── Projects.tsx
│   ├── Settings.tsx
│   └── settings/              # Nested route pages
│       ├── General.tsx
│       ├── Profile.tsx
│       └── Security.tsx
├── apis/                      # API functions and services
├── hooks/                     # Custom React hooks
│   └── use-mobile.ts
├── App.tsx                    # Routes configuration
├── main.tsx
└── index.css                  # Theme CSS variables
```

### Folder Structure Principles

- **`shadcn/`** - Contains all auto-generated shadcn components and utilities. Never edit these manually.
- **`components/`** - Your custom reusable components.
- **`navigation/`** - All navigation-related components.
- **`pages/`** - Route/page components, organized by route structure.
- **`apis/`** - API calls and backend integration.
- **`hooks/`** - Custom React hooks.

## Adding Components

Use the shadcn CLI to add new components:

```bash
pnpm dlx shadcn@latest add [component-name]
```

## MCP Integration

This template includes Chrome DevTools MCP server configuration for Claude Code. The `.mcp.json` file enables AI-assisted debugging with Chrome DevTools.

To use:
1. Ensure Claude Code is installed
2. The MCP server will automatically start when needed
3. Claude can now inspect, debug, and interact with your running app

## Using as a Template

To use this as a template for a new project:

1. **Clone or copy** this directory
2. **Update package.json** with your project name
3. **Customize theme** using TweakCN (see Theme Customization section)
4. **Update routes** in `src/App.tsx` - add your pages and routes
5. **Modify navigation** in `src/navigation/app-sidebar.tsx` - update menu items
6. **Add your pages** in `src/pages/`
7. **Add API calls** in `src/apis/`
8. **Update README** with your project details

### Adding New Routes

1. Create your page component in `src/pages/`
2. Add the route to `src/App.tsx` in both the `routes` array and `<Routes>` component
3. (Optional) Add navigation item in `src/navigation/app-sidebar.tsx`

## Tech Stack

- [Vite](https://vitejs.dev/) - Build tool
- [React 19](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [React Router](https://reactrouter.com/) - Client-side routing
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling with @tailwindcss/vite
- [Shadcn/ui](https://ui.shadcn.com/) - Component library
- [TweakCN](https://tweakcn.com/editor/theme) - Theme customization
- [Lucide React](https://lucide.dev/) - Icon library

## License

MIT
