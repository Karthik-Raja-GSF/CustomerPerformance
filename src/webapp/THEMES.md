# Theme Customization Guide

This guide explains how to customize the theme in the SET React + Shadcn Template using [TweakCN](https://tweakcn.com/editor/theme).

## Understanding the Theme System

The template uses:
- **OKLCH color space** - Modern color format with better perceptual uniformity
- **CSS custom properties** - CSS variables in `src/index.css`
- **Light/Dark modes** - Separate color definitions for each mode
- **Simple customization** - Just copy and paste from TweakCN

## Customizing Your Theme

### Step 1: Design Your Theme on TweakCN

1. Visit [https://tweakcn.com/editor/theme](https://tweakcn.com/editor/theme)
2. Choose or customize your colors:
   - **Background** - Main page background
   - **Foreground** - Main text color
   - **Primary** - Primary buttons, links
   - **Secondary** - Secondary elements
   - **Muted** - Subtle backgrounds
   - **Accent** - Highlighted elements
   - **Destructive** - Error states
   - **Border** - Border colors
   - **Sidebar** - Sidebar-specific colors

3. Toggle between light and dark modes to design both

### Step 2: Copy the CSS Variables

1. In TweakCN, copy the generated CSS variables
2. You'll get CSS like this:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ... more variables */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... more variables */
}
```

### Step 3: Paste into Your Project

1. Open `src/index.css`
2. Find the `:root {` section (starts around line 9)
3. **Replace everything from `:root {` to the closing `}` (before `.dark`)** with your light theme from TweakCN
4. Find the `.dark {` section
5. **Replace everything from `.dark {` to the closing `}` (before `@theme inline`)** with your dark theme from TweakCN

**Important Notes:**
- Replace the **entire** `:root` block including all CSS variables (colors, fonts, shadows, radius, etc.)
- Replace the **entire** `.dark` block the same way
- Do NOT modify the `@theme inline` section below - that's framework code
- The file structure is organized with clear sections to help you

### Step 4: See Your Theme Live

The changes apply immediately! Toggle between light/dark mode using the button in the top-right corner.

## What TweakCN Provides

TweakCN gives you ALL theme variables in one complete package:

### Color Variables
- Core colors: background, foreground, primary, secondary, muted, accent, destructive
- Component colors: card, popover, sidebar, border, input, ring
- Chart colors: chart-1 through chart-5

### Typography
- `--font-sans`, `--font-serif`, `--font-mono` - Font families

### Layout
- `--radius` - Border radius for components
- `--spacing` - Base spacing unit

### Shadows
- Complete shadow system from `--shadow-2xs` to `--shadow-2xl`
- Shadow configuration: x, y, blur, spread, opacity, color

### Letter Spacing
- `--tracking-normal` - Letter spacing value

Simply copy the entire `:root` and `.dark` blocks from TweakCN to get all of these configured together.

## Tips

- **Test both modes**: Always check light and dark modes with the toggle button
- **Contrast ratios**: Ensure sufficient contrast for accessibility
- **Consistency**: Keep related colors harmonious
- **Preview**: Use TweakCN's preview to see your theme before copying
- **Sidebar colors**: Pay special attention to sidebar colors for a cohesive look
- **Hot reload**: Vite will automatically update when you save `index.css`

## Troubleshooting

**Theme not applying?**
- Make sure you saved `index.css`
- Check the browser console for CSS errors
- Verify OKLCH format is correct (copy exactly from TweakCN)

**Colors look wrong?**
- Ensure you replaced ALL variables in both `:root` and `.dark`
- Don't mix up light and dark mode variables
- Check that you didn't accidentally delete the closing braces `}`

**Dark mode not working?**
- Click the sun/moon button in the top-right to toggle
- Check browser console for JavaScript errors
- Make sure both `:root` and `.dark` sections have all variables
