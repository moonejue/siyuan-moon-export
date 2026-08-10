/**
 * SiYuan Kernel API 封装
 */

import { getActiveTab } from "siyuan";

const API_URL = "http://127.0.0.1:6806";

async function request(endpoint: string, data: Record<string, any> = {}): Promise<any> {
    const resp = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (result.code !== 0) throw new Error(result.msg || "API Error");
    return result.data;
}

/** 思源 /api/file/putFile 必须使用 multipart/form-data，不能发 JSON。 */
async function putFile(path: string, content: string): Promise<void> {
    const form = new FormData();
    form.append("path", path);
    form.append("isDir", "false");
    form.append("modTime", String(Date.now()));
    form.append("file", new Blob([content], { type: "text/markdown;charset=utf-8" }), path.split("/").pop() || "export.md");
    const resp = await fetch(`${API_URL}/api/file/putFile`, { method: "POST", body: form });
    const result = await resp.json();
    if (result.code !== 0) throw new Error(result.msg || "写入 Markdown 文件失败");
}

async function makeDir(path: string): Promise<void> {
    const form = new FormData();
    form.append("path", path);
    form.append("isDir", "true");
    form.append("modTime", String(Date.now()));
    const resp = await fetch(`${API_URL}/api/file/putFile`, { method: "POST", body: form });
    const result = await resp.json();
    if (result.code !== 0) throw new Error(result.msg || "创建导出目录失败");
}

export async function getNotebooks(): Promise<Array<{ id: string; name: string; closed: boolean }>> {
    const data = await request("/api/notebook/lsNotebooks");
    return data.notebooks || [];
}

export async function getDocsByPath(notebookId: string, path: string = "/"): Promise<any[]> {
    const data = await request("/api/filetree/listDocsByPath", { notebook: notebookId, path });
    return data.files || [];
}

export async function exportMdContent(docId: string): Promise<{ hPath: string; content: string }> {
    return await request("/api/export/exportMdContent", { id: docId });
}

export async function sqlQuery(stmt: string): Promise<any[]> {
    const data = await request("/api/query/sql", { stmt });
    return data || [];
}

export async function getAllDocs(notebookId: string): Promise<Array<{ id: string; title: string; path: string; box: string }>> {
    const stmt = `SELECT b.id, b.content as title, b.path, b.box FROM blocks b WHERE b.type='d' AND b.box='${notebookId}' ORDER BY b.path`;
    return await sqlQuery(stmt);
}

export async function getCurrentDocId(): Promise<string | null> {
    // 方案1: 使用思源插件 API，直接获取当前激活的编辑器 Tab。
    // 这是比 DOM 查询可靠得多的官方路径。
    try {
        const tab: any = getActiveTab(true);
        const candidates = [
            tab?.model?.editor?.rootId,
            tab?.model?.editor?.blockId,
            tab?.model?.editor?.protyle?.rootId,
            tab?.model?.editor?.protyle?.blockId,
            tab?.model?.editor?.protyle?.title?.getAttribute?.("data-node-id"),
            tab?.model?.editor?.protyle?.element?.getAttribute?.("data-node-id"),
            tab?.model?.editor?.protyle?.element?.querySelector?.("[data-node-id]")?.getAttribute?.("data-node-id"),
            tab?.id,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === "string" && /^\d{14}-[a-z0-9]+$/i.test(candidate)) {
                return candidate;
            }
        }
    } catch (e) {
        console.log("[Moon Export] getActiveTab failed, trying DOM fallback", e);
    }

    // 方案2: 当前聚焦编辑器的多个 DOM 结构兼容路径。
    const selectors = [
        ".layout__center .protyle[data-node-id]",
        ".layout__center .protyle-wysiwyg[data-doc-id]",
        ".protyle[data-node-id]",
        ".protyle-wysiwyg[data-doc-id]",
    ];
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i] as HTMLElement;
            const id = el.getAttribute("data-node-id") || el.getAttribute("data-doc-id");
            if (id && /^\d{14}-[a-z0-9]+$/i.test(id)) return id;
        }
    }

    // 方案3: 通过当前编辑器中的任意块 ID，向上找到文档根块。
    const focused = document.querySelector(".protyle-wysiwyg--focused") as HTMLElement;
    const block = focused?.closest(".protyle")?.querySelector("[data-node-id]") as HTMLElement;
    const blockId = block?.getAttribute("data-node-id");
    if (blockId && /^\d{14}-[a-z0-9]+$/i.test(blockId)) {
        try {
            const rows = await sqlQuery(`SELECT root_id FROM blocks WHERE id='${blockId}' LIMIT 1`);
            if (rows?.[0]?.root_id) return rows[0].root_id;
        } catch (e) {
            console.log("[Moon Export] block root lookup failed", e);
        }
    }

    return null;
}

export async function writeFile(filePath: string, content: string): Promise<void> {
    // 导出路径为相对于思源工作空间 data/ 目录的路径。
    const normalized = filePath.replace(/^\/+/, "");
    await putFile(`data/${normalized}`, content);
}

export async function createDir(dirPath: string): Promise<void> {
    const normalized = dirPath.replace(/^\/+/, "");
    await makeDir(`data/${normalized}`);
}
