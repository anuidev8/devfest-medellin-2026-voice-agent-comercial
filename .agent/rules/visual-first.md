<!-- ai-design-framework:visual-first:start -->
## Visual-first UI work (ai-design-framework)

For any task that creates or changes how a UI looks or moves — a new page, screen, component, redesign, theme, animation, or a design from references:

1. **Show before you build.** First create a self-contained HTML preview in `design/` (for example `design/preview.html`) using real copy, the real colors, type, motion and interactions. Do not edit app source code yet.
2. **Make the user see it.** Serve and open it — `node .agent/skills/ai-design-framework/scripts/serve.mjs design preview` — then open the URL in your browser tool, screenshot desktop + mobile, and put the screenshots and URL in your reply. A file the user never saw doesn't count.
3. **Wait for approval.** Ask "approve or change?" and end your turn. "ok/continue" approves only the step you're waiting on. Never mark a design approved yourself.
4. **Build from the approved preview.** Treat it as the spec, then compare the built UI against it with screenshots.
5. **Explain motion and interaction.** Every animation states what it means to the user; every interaction states trigger → feedback → end state. Tag them in the preview with `data-motion` / `data-interaction`.

Small fixes (a typo, one CSS value, a bug with no visual decision) skip the preview. When the user gives Pinterest links or asks for a mood board or design proposal, use the `ai-design-framework` skill.
<!-- ai-design-framework:visual-first:end -->
