# 风吹叶片过渡页 V1 · 图像生成提示词

生成方式：Codex 内置 ImageGen，编辑现有春日草地背景。

```text
Use case: ui-mockup
Asset type: portrait mobile game transition/loading screen background keyframe, designed for a 750 × 1334 screen
Input images: Image 1 is the edit target and exact landscape base; Image 2 is a style reference for the established garden color language; Image 3 is a style reference for the in-game colored-pencil treatment
Primary request: Preserve Image 1's spring meadow composition, sky, clouds, bushes, flowers, and open grassy center. Add a full-screen wind transition made from individually hand-drawn leaves sweeping from the upper-right toward the lower-left along two broad curved wind paths. Leaves should vary naturally in size, rotation, and spacing, with denser groups near screen edges and enough open space through the middle for loading copy. Add only a few subtle colored-pencil wind streaks that follow the leaves.
Style/medium: 2D children's colored-pencil and wax-crayon illustration on textured paper, visibly hand drawn, dark-brown imperfect outlines, flat matte color
Composition/framing: vertical full-screen view; leaves travel across the entire page rather than sitting in one cluster; keep the center readable
Color palette: match Image 1 exactly; leaves in garden greens, yellow-green, warm ochre, and a few coral-orange accents
Text: none
Constraints: no central panel, no card, no frame, no logo, no characters, no number blocks, no progress bar, no UI text, no glossy highlights, no glass, no plastic 3D rendering, no gradient glow, no watermark; preserve the original landscape and pencil texture as closely as possible
Avoid: AI-polished look, airbrushed shading, thick shiny bevels, crowded center, repeated identical leaves
```

中文字、百分比和进度条由 `render_transition_loading_v1.py` 确定性排版，避免生成式文字错误。
