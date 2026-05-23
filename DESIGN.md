# ProviaAI — Design System

## Color Strategy: Restrained
One saturated accent on tinted dark neutrals. The accent appears only for interactive elements, AI activity, and correct states.

## Tokens
```
--a:      #1bff8c   /* Primary accent — green */
--a2:     #16d475   /* Accent hover */
--a-dim:  rgba(27,255,140,.07)
--a-glow: rgba(27,255,140,.18)

--bg:  #08100d   /* Page background */
--s:   #0f1a13   /* Surface */
--s2:  #142018   /* Surface elevated */
--s3:  #1a2820   /* Surface highest */

--t:   #e8f5ee   /* Text primary */
--t2:  #9dbfad   /* Text secondary */
--t3:  #5e856e   /* Text muted */

--l:   rgba(27,255,140,.09)   /* Border subtle */
--l2:  rgba(27,255,140,.20)   /* Border default */
--l3:  rgba(27,255,140,.32)   /* Border emphasis */

--r:  6px   /* Border radius default */
--r2: 4px   /* Border radius small */
--max: 1080px
```

## Typography
- **UI font**: DM Sans (400/500/600/700)
- **Mono font**: DM Mono (labels, badges, code, monospaced data)
- Base size: 13–14px for UI, 15–16px for body text
- Letter-spacing: tight on headings (−0.03 to −0.04em), wide on mono labels (+0.08–0.14em)

## Components
- **Buttons**: `btnP` (accent-filled, primary), `btnG` (ghost), `btn` (surface-filled default)
- **Badges**: mono font, small caps, subtle border
- **Cards**: surface background, subtle border (--l2), 6px radius, box-shadow
- **Inputs**: surface bg, border --l2, focus ring uses --a

## Elevation / Shadows
- `--sh`:  0 8px 32px rgba(0,0,0,.5)
- `--sh2`: 0 20px 56px rgba(0,0,0,.6)
- `--sh3`: 0 32px 80px rgba(0,0,0,.7)

## Motion
- Default transition: 0.15s cubic-bezier(.22,.61,.36,1)
- Entrance animations: translateY(-4px) → 0, opacity 0 → 1
- Pulse/glow keyframes on accent elements (AI activity indicator)
