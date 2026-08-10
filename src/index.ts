/**
 * Moon Export — SiYuan Plugin
 * 月亮导出 — 将思源笔记导出为 Markdown
 */

import { Plugin } from "siyuan";
import { openExportDialog } from "./dialog";
import "./index.scss";

export default class MoonExportPlugin extends Plugin {

    private isMobile = false;

    async onload(): Promise<void> {
        this.isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent||"");
    }

    onLayoutReady(): void {
        if (!this.isMobile) {
            // 使用内联 SVG 月亮图标（SiYuan 支持 icon 参数传入 SVG 字符串）
            const moonSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                <circle cx="12" cy="12" r="10" fill="#A98C6E" opacity="0.12"/>
                <path d="M15 5C10 6 7 10 7 15C7 17.5 8 19.5 10 21C6 19.5 4 16 4 12C4 7.5 7.5 4 12 4C13 4 14 4.2 15 5Z" fill="#917459"/>
            </svg>`;
            this.addTopBar({
                icon: moonSvg,
                title: this.i18n.topbarTooltip || "导出笔记为 Markdown",
                position: "right",
                callback: () => this.openDialog(),
            });
        }
        this.addCommand({
            langKey: "topbarTooltip",
            hotkey: "",
            callback: () => this.openDialog(),
        });
    }

    onunload(): void {
        document.getElementById("moon-export-dialog")?.remove();
        document.getElementById("moon-export-toast")?.remove();
        document.getElementById("moon-export-anims")?.remove();
    }

    private async openDialog(): Promise<void> {
        await openExportDialog(this.i18n);
    }
}
