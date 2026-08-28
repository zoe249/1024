# 首次进入页背景三方案 V1

三张图片均由 Codex 内置 ImageGen 独立生成，没有烘焙 Logo、文字、进度条或其他 UI。
`*-source.png` 为生成设计源，`*-background.jpg` 为 `750 × 1334` 轻量纯背景，
`*-preview.jpg` 为叠加当前启动页信息层后的选型预览。

## 方案概览

| 方案 | 视觉方向 | 适合场景 |
| --- | --- | --- |
| A 彩铅晨光 | 花拱门、温室、彩铅蜡笔纸纹 | 与现有首页最连贯，适合作为默认品牌方案 |
| B 手工剪纸 | 多层纤维纸、轻纸影、溪流草丘 | 画面最清爽，UI 可读性和轻量化最好 |
| C 夜光水彩 | 蓝紫暮色、湿画法、萤火与月光小径 | 氛围记忆点最强，适合强调梦幻感 |

当前活动启动页配置没有被修改，选定方案后再将对应 `*-background.jpg` 接入即可。

## A 彩铅晨光 · 最终提示词

```text
Use case: stylized-concept
Asset type: portrait mobile game first-entry / startup background, designed for final delivery at 750 × 1334 px (9:16 portrait)
Input images:
- Image 1: visual-style and palette reference only — use its handmade children's colored-pencil sky, fluffy crayon clouds, vivid spring greens, and cheerful tactile grain.
- Image 2: current startup-background style reference only — keep the same charming colored-pencil / wax-crayon family and friendly garden world, but create a clearly different composition and do not copy its central dirt-road layout or character arrangement.
- Image 3: brand-language reference only — understand the yellow, orange, green, and blue palette and the rounded friendly number-tile personality; do NOT reproduce, trace, place, or bake in the logo, title, Chinese characters, or “1024”.

Primary request: Create an original “Colored-Pencil Morning Light” background for a children-friendly falling-number merge game. A whimsical flower-garden archway frames the entrance to a softly winding stepping-stone path. The path leads into the distance toward a tiny glass greenhouse or delicate garden pavilion nestled among rounded spring shrubs. Warm early-morning sunlight glows near the horizon. A few rounded, friendly number-tile companions peek in only partially from the extreme bottom-left and bottom-right edges, small and secondary, never entering the central information area.

Scene/backdrop: blue spring morning sky, airy hand-drawn clouds kept mostly near outer edges, distant soft hills and flowering shrubs, garden archway around the lower-middle transition, curved stepping stones, tiny greenhouse/pavilion far away.
Style/medium: polished 2D children's picture-book illustration made with colored pencils and wax crayons on lightly textured paper; visible organic strokes, gentle imperfect outlines, layered hand coloring; playful and warm; absolutely not 3D.
Composition/framing:
- portrait 9:16;
- reserve the entire top approximately 32% as calm, clean blue-sky negative space for a separately overlaid logo: no architecture, characters, leaves, birds, sun, clouds, or focal detail in the central top safe zone;
- keep the middle visually quiet and readable, with the arch and landscape sitting below the logo zone;
- keep the lower center open and low-contrast enough for a status label and progress bar overlay; no character, flower, stone edge, or busy detail crossing that bottom-center UI safe zone;
- number-tile companions may only peek from the two bottom side edges, cropped by the frame, with at most three total;
- strong depth and gentle S-curve flow, but a distinctly new composition from Image 2.
Lighting/mood: fresh spring dawn, soft golden rim light, optimistic, welcoming, calm, magical without fantasy clutter.
Color palette: sky cyan and cerulean, fresh leaf greens, butter-yellow sunrise, small coral-orange and sky-blue accents; harmonious with Image 3 but no logo.
Materials/textures: dry colored-pencil hatching, wax-crayon grain, subtle cream paper fibers, hand-painted cloud edges.
Text: none.
Constraints: background art only; no logo; no title; no Chinese or English words; no lettering; no UI; no progress bar; no watermark; no border; preserve generous empty sky and empty lower-center overlay areas; garden archway, winding stepping-stone path, and distant greenhouse or pavilion must all be clearly recognizable.
Avoid: 3D render, glossy plastic, candy-shop or dessert theme, photorealism, vector-flat style, crowded center, giant mascots, central foreground character, castle, fantasy portal glow, signage, readable text, “1024”, brand marks, watermarks.
```

## B 手工剪纸 · 最终提示词

```text
Use case: stylized-concept
Asset type: portrait mobile-game first-launch background, intended to be cropped/resampled to exactly 750 × 1334 pixels
Primary request: Create an original “layered handmade paper garden” background for a cheerful number-merging children's game. This must be a clean environment background only, with no baked-in branding or interface.
Input images:
- Image 1: composition and palette reference only; use its generous blue-sky negative space and bright garden mood, but do not copy its brushwork literally.
- Image 2: brand-world reference only; use its friendly garden atmosphere and distant winding path idea, but redesign the scene completely as layered cut paper and do not copy the existing characters.
- Image 3: palette and rounded friendly brand personality reference only; absolutely do not reproduce, trace, imitate, or include its logo, lettering, Chinese characters, digits, numbers, or layout.
Scene/backdrop: A luminous handcrafted garden made from many layers of carefully cut colored paper. A narrow cream-yellow paper path or a simple pale-blue paper stream begins near the lower center, stays visually quiet around the bottom-center UI-safe zone, and gently leads toward a small distant horizon. Layered rolling grass hills, a few paper clouds, restrained flowers, petals, and leaves sit mainly along the side and bottom edges.
Subject: The garden itself. Add only two or three small rounded-square mascot-like paper blocks peeking from foliage at the extreme lower left and lower right edges as secondary accents. Their fronts must be completely free of digits, letters, icons, or symbols; simple friendly eyes and tiny smiles only. Keep them small and partly hidden, never a central subject.
Style/medium: refined yet childlike multilayer handmade cut-paper collage; tactile matte cardstock and fibrous handmade-paper surfaces; subtly imperfect hand-cut edges; shallow dimensional layering; delicate realistic paper-cast shadows between overlapping pieces. Premium children's picture-book craft, clean and intentional, not photorealistic scenery and not 3D plastic.
Composition/framing: vertical 9:16-adjacent portrait composition for a 750 × 1334 mobile screen. Reserve the entire top approximately 32% as uncluttered bright cyan-blue paper sky for a separate logo overlay: no clouds, leaves, petals, characters, horizon, or focal object intruding into this top safe zone. Keep the middle calm, airy, and low-detail. Keep the bottom-center region calm and contrast-controlled so separate loading status text and a progress bar remain legible; route the path/stream softly behind or around this zone rather than creating a bright focal knot. Place detail density mainly in the lower outer corners. Preserve safe margins for full-screen mobile cropping.
Lighting/mood: warm optimistic morning light, playful, welcoming, serene; subtle believable shadows from paper layers, no dramatic lighting.
Color palette: bright cyan blue, tender leaf green, cream yellow, coral orange, with restrained white and pale aqua accents. Balanced saturation; fresh, sunny, cohesive.
Materials/textures: visible paper fibers, matte cardstock grain, layered torn/cut paper, gentle bevel only from actual paper thickness, soft realistic paper shadows.
Text: none.
Constraints: no words, no letters, no Chinese characters, no numerals, no numbers, no logo, no title, no watermark, no UI, no loading bar, no buttons, no frames. Background only. Maintain a clean top 32%, quiet middle, and usable quiet bottom-center UI zone. Original composition, not a recreation of any reference.
Avoid: plastic 3D, glossy toy render, clay render, candy shop, confectionery motifs, sweets, balloons, game-board grids, complex central subject, busy center, large mascots, oversized flowers, symmetrical stage composition, harsh outlines, heavy drop shadows, gradients that look digital, text-like marks, accidental glyphs or digits.
```

## C 夜光水彩 · 最终提示词

```text
Use case: stylized-concept
Asset type: vertical mobile game first-entry splash background, designed for a final 750 × 1334 px canvas (approximately 9:16 portrait).

Input images:
- Image 1: visual reference for airy hand-painted background treatment and generous negative space.
- Image 2: visual reference for the Number Garden world's natural garden setting, winding-path composition, and friendly rounded block-partner vocabulary.
- Image 3: brand-language reference only for the handmade paper texture, rounded shapes, and cheerful color relationships. Do NOT reproduce, trace, imitate, or embed its logo, Chinese title, numerals, or lettering.

Primary request: Create an original “Luminous Watercolor Night Garden” background for the first screen of a child-friendly falling-number merge game. It must be a pure environment background with no interface baked into it.

Scene/backdrop: a dreamy blue-violet twilight garden with teal and emerald grass. A softly luminous watercolor path begins near the bottom center and gently winds toward a distant rounded tree-covered hill or subtle moonlit garden arch. Add sparse soft moonlight, a few tiny warm fireflies, delicate glowing dandelion seeds, and only a small number of warm yellow flowers for contrast. The atmosphere is magical, welcoming, clear, and hopeful—never dark, gloomy, or threatening.

Subject: only two or three small, original rounded square garden companions peeking partially into frame from the extreme bottom-left and bottom-right edges. They have simple friendly faces, no markings and no numbers, and are softly illuminated by warm reflected light. Keep them secondary and cropped by the frame; do not let them intrude into the bottom-center UI-safe area.

Style/medium: charming children's-book watercolor illustration; wet-on-wet washes, soft pigment blooms, visible cold-pressed paper grain, hand-painted edges, subtle colored-pencil accents. Cohesive with the references' warm handmade spirit while clearly being a new night-watercolor variant. Painterly 2D only.

Composition/framing:
- exact portrait intent, approximately 9:16.
- Top 32% is a low-detail open blue-violet twilight sky for a separately overlaid logo: no characters, no moon disk, no large clouds, no flowers, no firefly cluster, and no focal object there; only restrained watercolor wash and faint paper texture.
- Middle zone is quiet and uncluttered, with soft depth and a distant low tree line / rounded hill. The winding path may lead the eye upward but must not create a bright central hotspot.
- Bottom-center is reserved for separately overlaid loading status and progress bar: keep it broad, calm, low-detail, low-contrast, and readable; the path should become a smooth softly glowing wash here rather than textured clutter.
- Keep decorative foliage, the few flowers, and the cropped block companions mostly at the lower side edges.
- Maintain clear visual hierarchy and ample breathing room for UI.

Lighting/mood: diffused pearly moonlight from outside the frame, gentle teal-to-indigo ambient glow, tiny warm golden accents, luminous but not neon. Dreamlike, playful, peaceful, optimistic, suitable for children.

Color palette: blue-violet and indigo twilight, teal and emerald greens, soft periwinkle haze, small warm honey-yellow flower/firefly highlights. Preserve enough luminosity and color contrast for a cheerful game; avoid muddy blacks.

Materials/textures: authentic watercolor pooling and blooms, translucent layered washes, visible paper grain, light colored-pencil scribble texture. Avoid glossy surfaces.

Constraints: original artwork; background only; no text, no Chinese characters, no letters, no digits, no mathematical symbols, no logo, no title, no slogan, no watermark, no loading bar, no buttons, no UI panels, no frames. Do not bake any element from Image 3 into the artwork. No recognizable copyrighted characters. Keep all important elements away from the top-logo safe area and bottom-center status safe area.

Avoid: neon cyberpunk; 3D render; glossy plastic; vector-flat gradients; horror; spooky eyes; darkness or oppressive mood; candy shop; candy-land scenery; excessive sparkles; busy floral clutter; dense stars; giant moon; castle; text-like marks; number-shaped objects; logo-like composition; watermark.
```
