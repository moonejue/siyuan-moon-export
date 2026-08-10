/**
 * Moon Export Dialog — 月亮老师品牌风格
 */

import {
    getNotebooks, getAllDocs, getCurrentDocId,
    exportMdContent, writeFile, createDir,
} from "./api";

export interface ExportOptions {
    includeFrontmatter: boolean;
    includeImages: boolean;
    exportPath: string;
}

function generateFrontmatter(title: string, docId: string): string {
    const now = new Date();
    const d = (dd: Date) => `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
    const created = `${docId.substring(0,4)}-${docId.substring(4,6)}-${docId.substring(6,8)}`;
    return `---\ntitle: "${title}"\ncreated: "${created}"\nexported: "${d(now)}"\nsource: "siyuan"\n---\n\n`;
}

function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g,"-").replace(/\s+/g,"_").trim().substring(0,200);
}

function showToast(msg: string, type: "success"|"error"|"info"="info"): void {
    const old = document.getElementById("moon-export-toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.id = "moon-export-toast";
    const colors = type==="success"
        ? "background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7"
        : type==="error"
        ? "background:#fce4ec;color:#c62828;border:1px solid #ef9a9a"
        : "background:#f6f1e8;color:#675b4c;border:1px solid #bcc1b9";
    t.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:12px 28px;border-radius:12px;font-size:14px;font-family:"PingFang SC","Microsoft YaHei",sans-serif;animation:moonFadeIn .3s ease;${colors}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function injectAnimations(): void {
    if (document.getElementById("moon-export-anims")) return;
    const s = document.createElement("style");
    s.id = "moon-export-anims";
    s.textContent = `@keyframes moonFadeIn{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes moonSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(s);
}

export async function openExportDialog(i18n: Record<string, string>): Promise<void> {
    injectAnimations();
    const old = document.getElementById("moon-export-dialog");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "moon-export-dialog";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(71,60,47,.35);z-index:99990;display:flex;align-items:center;justify-content:center;animation:moonFadeIn .2s ease";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background:linear-gradient(145deg,#faf7f0,#f3ece0);border-radius:20px;box-shadow:0 12px 48px rgba(71,60,47,.18);width:640px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;font-family:'PingFang SC','Microsoft YaHei',sans-serif;animation:moonSlideUp .3s ease;border:1px solid rgba(169,140,110,.18)";

    const currentDocId = await getCurrentDocId();
    let allDocs: any[] = [];
    try {
        const nbs = await getNotebooks();
        for (const nb of nbs) {
            try {
                const docs = await getAllDocs(nb.id);
                allDocs = allDocs.concat(docs.map((doc: any) => ({ ...doc, notebookName: nb.name, notebookId: nb.id })));
            } catch (e) {}
        }
    } catch (e) {}

    let activeTab: "current"|"batch" = "current";
    const selectedDocIds = new Set<string>();
    const options: ExportOptions = { includeFrontmatter: true, includeImages: true, exportPath: "export/markdown" };
    let isExporting = false;

    dialog.innerHTML = buildHTML(i18n);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    bindEvents(dialog, overlay, i18n, {
        getTab: () => activeTab, setTab: (t) => { activeTab = t; },
        selectedDocIds, options, currentDocId, allDocs,
        getExporting: () => isExporting, setExporting: (v) => { isExporting = v; },
        setExportPath: (path: string) => { options.exportPath = path; },
    });

    switchTab("current", dialog, i18n, { currentDocId, allDocs, selectedDocIds });
}

function buildHTML(i18n: Record<string, string>): string {
    return `
<div style="padding:24px 28px 18px;border-bottom:1px solid rgba(169,140,110,.15);display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#e8dfd2,#d4c5a0);display:flex;align-items:center;justify-content:center;font-size:18px">🌙</div>
        <div>
            <div style="font-size:18px;color:#473c2f;font-weight:700;letter-spacing:.05em">${i18n.dialogTitle||"月亮导出"}</div>
            <div style="font-size:12px;color:#a98c6e;margin-top:2px">${i18n.dialogSubtitle||""}</div>
        </div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
        <button class="moon-btn-export" style="padding:9px 22px;border:none;border-radius:10px;background:linear-gradient(135deg,#a98c6e,#917459);color:#f6f1e8;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:.03em;box-shadow:0 2px 8px rgba(169,140,110,.25);white-space:nowrap">${i18n.exportBtn||"导出为 Markdown"}</button>
        <button class="moon-dialog-close" style="background:none;border:none;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#a98c6e;font-size:20px">✕</button>
    </div>
</div>
<div style="display:flex;padding:0 28px;gap:0;border-bottom:1px solid rgba(169,140,110,.12)">
    <button class="moon-tab moon-tab-active" data-tab="current" style="padding:12px 20px;border:none;background:none;font-size:14px;color:#473c2f;cursor:pointer;border-bottom:2px solid #a98c6e;font-weight:600">📄 ${i18n.tabCurrent||"当前文档"}</button>
    <button class="moon-tab" data-tab="batch" style="padding:12px 20px;border:none;background:none;font-size:14px;color:#bcc1b9;cursor:pointer;border-bottom:2px solid transparent;font-weight:500">📚 ${i18n.tabBatch||"批量导出"}</button>
</div>
<div class="moon-dialog-body" style="padding:24px 28px;overflow-y:auto;flex:1">
    <div class="moon-panel-current" style="display:block">
        <div style="padding:20px;border-radius:14px;background:linear-gradient(135deg,#f6f1e8,#f0e6d8);border:1px solid rgba(169,140,110,.12);margin-bottom:20px">
            <p style="margin:0;color:#675b4c;font-size:14px;line-height:1.8">${i18n.currentDocInfo||""}</p>
            <div class="moon-doc-info" style="margin-top:14px;padding:12px 16px;background:rgba(255,255,255,.6);border-radius:10px;font-size:13px;color:#a98c6e">检测中...</div>
        </div>
    </div>
    <div class="moon-panel-batch" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div class="moon-selected-count" style="font-size:13px;color:#917459">${(i18n.selectedCount||"").replace("{0}","0")}</div>
            <div style="display:flex;gap:8px">
                <button class="moon-btn-sel-all" style="padding:6px 14px;border:1px solid rgba(169,140,110,.3);border-radius:8px;background:rgba(255,255,255,.6);color:#675b4c;font-size:12px;cursor:pointer">${i18n.selectAll||"全选"}</button>
                <button class="moon-btn-desel-all" style="padding:6px 14px;border:1px solid rgba(169,140,110,.3);border-radius:8px;background:rgba(255,255,255,.6);color:#675b4c;font-size:12px;cursor:pointer">${i18n.deselectAll||"取消全选"}</button>
            </div>
        </div>
        <div style="margin-bottom:8px">
            <input class="moon-search-input" placeholder="${i18n.searchPlaceholder||"搜索笔记标题..."}" style="width:100%;padding:10px 14px;border:1px solid rgba(169,140,110,.2);border-radius:10px;font-size:13px;color:#675b4c;background:rgba(255,255,255,.6);outline:none;box-sizing:border-box">
        </div>
        <div style="margin:0 0 12px;color:#a98c6e;font-size:11px">${i18n.directorySelectHint||"点击目录可级联选择下级文档，再次点击可取消"}</div>
        <div class="moon-doc-list" style="max-height:330px;overflow-y:auto;border:1px solid rgba(169,140,110,.12);border-radius:12px;background:rgba(255,255,255,.5)">
            <div style="padding:32px;text-align:center;color:#a98c6e;font-size:13px">${i18n.loading||"加载中..."}</div>
        </div>
    </div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(169,140,110,.12)">
        <div style="font-size:13px;color:#917459;margin-bottom:10px;font-weight:600;letter-spacing:.03em">${i18n.exportPath||"Markdown 保存路径"}</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
            <input class="moon-export-path" value="export/markdown" placeholder="${i18n.exportPathPlaceholder||"例如：export/markdown"}" style="flex:1;min-width:0;padding:10px 12px;border:1px solid rgba(169,140,110,.2);border-radius:10px;font-size:13px;color:#675b4c;background:rgba(255,255,255,.6);outline:none;box-sizing:border-box">
            <button class="moon-btn-path-reset" style="padding:0 13px;border:1px solid rgba(169,140,110,.3);border-radius:10px;background:rgba(255,255,255,.5);color:#675b4c;font-size:12px;cursor:pointer">${i18n.pathReset||"默认"}</button>
        </div>
        <div style="font-size:11px;color:#a98c6e;margin:0 0 12px">${i18n.exportPathHint||"相对于思源工作空间的 data/ 目录"}</div>
        <div style="font-size:13px;color:#917459;margin-bottom:10px;font-weight:600;letter-spacing:.03em">${i18n.optionsLabel||"导出选项"}</div>
        <label style="display:flex;align-items:center;gap:10px;padding:10px 0;cursor:pointer;font-size:13px;color:#675b4c">
            <input class="moon-opt-frontmatter" type="checkbox" checked style="accent-color:#a98c6e;width:16px;height:16px"> ${i18n.includeFrontmatter||""}
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:10px 0;cursor:pointer;font-size:13px;color:#675b4c">
            <input class="moon-opt-images" type="checkbox" checked style="accent-color:#a98c6e;width:16px;height:16px"> ${i18n.includeImages||""}
        </label>
    </div>
</div>
<div style="padding:8px 28px"></div>`;
}

function bindEvents(
    dialog: HTMLElement, overlay: HTMLElement, i18n: Record<string, string>,
    state: {
        getTab: () => string; setTab: (t: string) => void;
        selectedDocIds: Set<string>; options: ExportOptions;
        currentDocId: string|null; allDocs: any[];
        getExporting: () => boolean; setExporting: (v: boolean) => void;
        setExportPath: (path: string) => void;
    }
): void {
    const close = () => { overlay.style.opacity="0"; overlay.style.transition="opacity .15s"; setTimeout(()=>overlay.remove(),150); };
    dialog.querySelector(".moon-dialog-close")?.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target===overlay) close(); });

    // Tab switching
    dialog.querySelectorAll(".moon-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const t = (tab as HTMLElement).dataset.tab||"current";
            switchTab(t, dialog, i18n, { currentDocId: state.currentDocId, allDocs: state.allDocs, selectedDocIds: state.selectedDocIds });
            state.setTab(t);
        });
    });

    // Select all / deselect all
    dialog.querySelector(".moon-btn-sel-all")?.addEventListener("click", () => {
        state.allDocs.forEach(d => state.selectedDocIds.add(d.id));
        syncCheckboxes(dialog, state.selectedDocIds);
        updateCount(dialog, i18n, state.selectedDocIds.size);
    });
    dialog.querySelector(".moon-btn-desel-all")?.addEventListener("click", () => {
        state.selectedDocIds.clear();
        syncCheckboxes(dialog, state.selectedDocIds);
        updateCount(dialog, i18n, 0);
    });

    // Search
    const si = dialog.querySelector(".moon-search-input") as HTMLInputElement;
    si?.addEventListener("input", () => renderDocList(dialog, state.allDocs, state.selectedDocIds, i18n, si.value.toLowerCase()));

    // 保存路径 — 保留手动填写相对于思源 data/ 目录的路径
    const pathInput = dialog.querySelector(".moon-export-path") as HTMLInputElement;
    const pathReset = dialog.querySelector(".moon-btn-path-reset");
    const syncPath = () => {
        const value = pathInput.value.trim().replace(/^\/+|\/+$/g, "");
        pathInput.value = value || "export/markdown";
        state.setExportPath(pathInput.value);
    };
    pathInput?.addEventListener("change", syncPath);
    pathInput?.addEventListener("blur", syncPath);
    pathReset?.addEventListener("click", () => {
        pathInput.value = "export/markdown";
        state.setExportPath("export/markdown");
    });

    // Options
    const ofm = dialog.querySelector(".moon-opt-frontmatter") as HTMLInputElement;
    const oim = dialog.querySelector(".moon-opt-images") as HTMLInputElement;
    ofm?.addEventListener("change", () => { state.options.includeFrontmatter = ofm.checked; });
    oim?.addEventListener("change", () => { state.options.includeImages = oim.checked; });

    // Export button (in header)
    dialog.querySelector(".moon-btn-export")?.addEventListener("click", () => doExport(dialog, i18n, state));

    // Render doc list
    if (state.allDocs.length > 0) {
        renderDocList(dialog, state.allDocs, state.selectedDocIds, i18n, "");
    } else {
        const lc = dialog.querySelector(".moon-doc-list");
        if (lc) lc.innerHTML = `<div style="padding:32px;text-align:center;color:#a98c6e;font-size:13px">暂无文档</div>`;
    }
}

function switchTab(tab: string, dialog: HTMLElement, i18n: Record<string,string>, s: { currentDocId: string|null; allDocs: any[]; selectedDocIds: Set<string> }): void {
    dialog.querySelectorAll(".moon-tab").forEach(t => {
        const isActive = (t as HTMLElement).dataset.tab === tab;
        (t as HTMLElement).style.cssText = `padding:12px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:2px solid ${isActive?"#a98c6e":"transparent"};color:${isActive?"#473c2f":"#bcc1b9"};font-weight:${isActive?"600":"500"}`;
        isActive ? t.classList.add("moon-tab-active") : t.classList.remove("moon-tab-active");
    });
    const cp = dialog.querySelector(".moon-panel-current") as HTMLElement;
    const bp = dialog.querySelector(".moon-panel-batch") as HTMLElement;
    const eBtn = dialog.querySelector(".moon-btn-export") as HTMLElement;
    if (tab === "current") {
        cp.style.display = "block"; bp.style.display = "none";
        eBtn.textContent = i18n.exportCurrentBtn||"导出当前文档";
        const di = dialog.querySelector(".moon-doc-info");
        if (di) di.innerHTML = s.currentDocId ? `<span style="color:#2e7d32">已检测到当前打开的文档</span>` : `<span style="color:#c62828">${i18n.noActiveDoc||"请先打开一篇文档"}</span>`;
    } else {
        cp.style.display = "none"; bp.style.display = "block";
        eBtn.textContent = i18n.exportBatchBtn||"批量导出";
    }
}

function renderDocList(dialog: HTMLElement, docs: any[], selectedDocIds: Set<string>, i18n: Record<string,string>, filter: string): void {
    const lc = dialog.querySelector(".moon-doc-list");
    if (!lc) return;
    const q = filter.trim().toLowerCase();
    const filtered = q ? docs.filter(d => (d.title || "").toLowerCase().includes(q)) : docs;
    if (filtered.length === 0) {
        lc.innerHTML = `<div style="padding:32px;text-align:center;color:#a98c6e;font-size:13px">${q ? "没有找到匹配的笔记" : "暂无可导出的笔记"}</div>`;
        return;
    }

    // 构造“笔记本 → 上级目录 → 文档”的可点击树。
    // 目录节点的 data-dir-key 用于级联选择其全部下级文档。
    const sorted = [...filtered].sort((a, b) => `${a.notebookName || ""}/${a.path || ""}`.localeCompare(`${b.notebookName || ""}/${b.path || ""}`, "zh-CN"));
    const groups = new Map<string, any[]>();
    sorted.forEach(doc => {
        const notebook = doc.notebookName || "未命名笔记本";
        const rawPath = String(doc.path || "").replace(/^\/+|\/+$/g, "");
        const parent = rawPath.includes("/") ? rawPath.substring(0, rawPath.lastIndexOf("/")) : "";
        const key = `${notebook}::${parent}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(doc);
    });

    let html = "";
    let index = 0;
    let groupIndex = 0;
    for (const [groupKey, groupDocs] of groups) {
        const [notebook, parent] = groupKey.split("::");
        const dirKey = `${notebook}/${parent}`;
        const selectedCount = groupDocs.filter(d => selectedDocIds.has(d.id)).length;
        const allSelected = selectedCount === groupDocs.length;
        const partial = selectedCount > 0 && !allSelected;
        const depth = parent ? Math.min(parent.split("/").length, 5) : 0;
        const indent = 14 + depth * 16;
        const dirLabel = parent || "根目录";
        const groupId = `moon-dir-group-${groupIndex++}`;
        html += `<div class="moon-dir-item" data-dir-key="${escapeHtml(dirKey)}" data-group-id="${groupId}" style="display:flex;align-items:center;padding:10px 12px 10px ${indent}px;cursor:pointer;background:rgba(169,140,110,.12);gap:9px;border-bottom:1px solid rgba(169,140,110,.12);font-size:12px;font-weight:700;color:#564938">
            <span class="moon-dir-toggle" style="font-size:13px;color:#a98c6e;pointer-events:auto;width:12px;text-align:center;cursor:pointer">▾</span>
            <input type="checkbox" class="moon-dir-cb" ${allSelected ? "checked" : ""} ${partial ? "data-partial=\"true\"" : ""} style="accent-color:#a98c6e;width:15px;height:15px;flex-shrink:0;pointer-events:none">
            <span style="flex:1;pointer-events:none">${escapeHtml(notebook)} / ${escapeHtml(dirLabel)}</span>
            <span style="font-size:10px;color:#a98c6e;pointer-events:none">${groupDocs.length} 篇</span>
        </div>`;
        groupDocs.forEach(doc => {
            const rawPath = String(doc.path || "").replace(/^\/+|\/+$/g, "");
            const selected = selectedDocIds.has(doc.id);
            const bg = index++ % 2 === 0 ? "rgba(255,255,255,.42)" : "rgba(255,255,255,.18)";
            html += `<div class="moon-doc-item" data-doc-id="${escapeHtml(doc.id)}" data-dir-key="${escapeHtml(dirKey)}" data-group-id="${groupId}" style="display:flex;align-items:center;padding:9px 12px 9px ${indent + 18}px;cursor:pointer;background:${bg};gap:9px;border-bottom:1px solid rgba(169,140,110,.06);font-size:13px" onmouseover="this.style.background='rgba(169,140,110,.10)'" onmouseout="this.style.background='${bg}'">
                <span style="color:#a98c6e;font-size:12px;pointer-events:none">└</span>
                <input type="checkbox" class="moon-doc-cb" ${selected ? "checked" : ""} style="accent-color:#a98c6e;width:15px;height:15px;flex-shrink:0;pointer-events:none">
                <span style="flex:1;color:#473c2f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none">${escapeHtml(doc.title || "Untitled")}</span>
                <span style="flex-shrink:0;color:#bcc1b9;font-size:10px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none">${escapeHtml(rawPath)}</span>
            </div>`;
        });
    }
    lc.innerHTML = html;

    // 点击目录：全选下级；若该目录当前已全选，则取消下级选择。
    lc.querySelectorAll(".moon-dir-item").forEach(item => {
        item.addEventListener("click", (event) => {
            const dirItem = item as HTMLElement;
            const groupId = dirItem.dataset.groupId || "";
            const toggle = dirItem.querySelector(".moon-dir-toggle") as HTMLElement;
            const childrenRows = Array.from(lc.querySelectorAll(`.moon-doc-item[data-group-id="${groupId}"]`)) as HTMLElement[];
            const isCollapsed = dirItem.dataset.collapsed === "true";
            if ((event as MouseEvent).altKey || (event as MouseEvent).detail === 0) return;
            // 单击左侧三角只控制折叠；点击目录名称仍保留级联选择。
            const target = event.target as HTMLElement;
            if (target === toggle || target.closest(".moon-dir-toggle")) {
                const nextCollapsed = !isCollapsed;
                dirItem.dataset.collapsed = String(nextCollapsed);
                childrenRows.forEach(row => { row.style.display = nextCollapsed ? "none" : "flex"; });
                if (toggle) toggle.textContent = nextCollapsed ? "▸" : "▾";
                return;
            }
            const dirKey = dirItem.dataset.dirKey || "";
            const children = docs.filter(doc => {
                const notebook = doc.notebookName || "未命名笔记本";
                const path = String(doc.path || "").replace(/^\/+|\/+$/g, "");
                const parent = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
                return `${notebook}/${parent}` === dirKey;
            });
            const shouldSelect = !children.every(doc => selectedDocIds.has(doc.id));
            children.forEach(doc => shouldSelect ? selectedDocIds.add(doc.id) : selectedDocIds.delete(doc.id));
            renderDocList(dialog, docs, selectedDocIds, i18n, (dialog.querySelector(".moon-search-input") as HTMLInputElement)?.value || "");
            updateCount(dialog, i18n, selectedDocIds.size);
        });
    });

    lc.querySelectorAll(".moon-doc-item").forEach(item => {
        const cb = item.querySelector(".moon-doc-cb") as HTMLInputElement;
        const docId = (item as HTMLElement).dataset.docId || "";
        item.addEventListener("click", () => {
            cb.checked = !cb.checked;
            cb.checked ? selectedDocIds.add(docId) : selectedDocIds.delete(docId);
            updateCount(dialog, i18n, selectedDocIds.size);
        });
    });
}

function syncCheckboxes(dialog: HTMLElement, selectedDocIds: Set<string>): void {
    dialog.querySelectorAll(".moon-doc-item").forEach(item => {
        const docId = (item as HTMLElement).dataset.docId||"";
        const cb = item.querySelector(".moon-doc-cb") as HTMLInputElement;
        if (cb) cb.checked = selectedDocIds.has(docId);
    });
}

function updateCount(dialog: HTMLElement, i18n: Record<string,string>, count: number): void {
    const el = dialog.querySelector(".moon-selected-count");
    if (el) el.textContent = (i18n.selectedCount||"").replace("{0}", String(count));
}

async function doExport(dialog: HTMLElement, i18n: Record<string,string>, state: {
    getTab: () => string; selectedDocIds: Set<string>;
    options: ExportOptions; currentDocId: string|null; allDocs: any[];
    getExporting: () => boolean; setExporting: (v: boolean) => void;
}): Promise<void> {
    if (state.getExporting()) return;
    const tab = state.getTab();
    let docs: Array<{id:string;title:string}> = [];
    if (tab === "current") {
        if (!state.currentDocId) { showToast(i18n.noActiveDoc||"请先打开一篇文档","error"); return; }
        const cd = state.allDocs.find(d=>d.id===state.currentDocId);
        docs = [{ id: state.currentDocId, title: cd?.title||"Untitled" }];
    } else {
        if (state.selectedDocIds.size===0) { showToast(i18n.noDocSelected||"请至少选择一篇文档","error"); return; }
        docs = state.allDocs.filter(d=>state.selectedDocIds.has(d.id)).map(d=>({id:d.id,title:d.title||"Untitled"}));
    }
    state.setExporting(true);
    const eBtn = dialog.querySelector(".moon-btn-export") as HTMLElement;
    const orig = eBtn.textContent;
    eBtn.textContent = "⏳ "+ (i18n.exporting||"正在导出..."); eBtn.style.opacity=".7"; eBtn.style.pointerEvents="none";

    const dir = state.options.exportPath || "export/markdown";
    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`;
    let ok = 0; const errs: string[] = [];
    try {
        await createDir(dir);
        for (const doc of docs) {
            try {
                const r = await exportMdContent(doc.id);
                let c = r.content||"";
                if (state.options.includeFrontmatter) c = generateFrontmatter(doc.title, doc.id) + c;
                await writeFile(`${dir}/${sanitizeFilename(doc.title)}_${dateStr}.md`, c);
                ok++;
            } catch (e) { errs.push(`${doc.title}: ${e}`); }
        }
        if (ok>0) showToast((i18n.exportSuccessMsg||"").replace("{0}",String(ok)), "success");
        if (errs.length>0) showToast(`${i18n.exportFail||"失败"}: ${errs[0]}`, "error");
    } catch (e) {
        showToast(i18n.exportFailMsg||"导出出错", "error");
    } finally {
        eBtn.textContent = orig; eBtn.style.opacity="1"; eBtn.style.pointerEvents="auto";
        state.setExporting(false);
    }
}

function escapeHtml(text: string): string {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
}
