(function(f, define){
    define([ "../kendo.core" ], f);
})(function(){

(function(kendo) {
    'use strict';

    if (kendo.support.browser.msie && kendo.support.browser.version < 9) {
        return;
    }

    var $ = kendo.jQuery;
    var alphaNumRegExp = /:alphanum$/;

    var ACTIONS = {
       "up": "up",
       "down": "down",
       "left": "left",
       "right": "right",
       "home": "first-col",
       "ctrl+left": "first-col",
       "end": "last-col",
       "ctrl+right": "last-col",
       "ctrl+up": "first-row",
       "ctrl+down": "last-row",
       "ctrl+home": "first",
       "ctrl+end": "last",
       "pageup": "prev-page",
       "pagedown": "next-page"
    };

    var ENTRY_ACTIONS = {
        "tab": "next",
        "shift+tab": "previous",
        "enter": "lower",
        "shift+enter": "upper",
        "delete": "clearContents",
        "backspace": "clearContents",
        "shift+:alphanum": "edit",
        ":alphanum": "edit",
        "ctrl+:alphanum": "ctrl",
        ":edit": "edit"
    };

    var CONTAINER_EVENTS = {
        "wheel": "onWheel",
        "*+mousedown": "onMouseDown",
        "contextmenu": "onContextMenu",
        "*+mousedrag": "onMouseDrag",
        "*+mouseup": "onMouseUp",
        "*+dblclick": "onDblClick",
        "mousemove": "onMouseMove"
    };

    var CLIPBOARD_EVENTS = {
        "*+pageup": "onPageUp",
        "*+pagedown": "onPageDown",
        "mouseup": "onMouseUp",
        "*+cut": "onCut",
        "*+paste": "onPaste",
        "*+copy": "onCopy"
    };

    var EDITOR_EVENTS = {
        "esc": "onEditorEsc",
        "enter": "onEditorBlur",
        "alt+enter": "insertNewline",
        "shift+enter": "onEditorBlur",
        "tab": "onEditorBlur",
        "shift+tab": "onEditorBlur"
    };

    var FORMULABAR_EVENTS = $.extend({ focus: "onEditorBarFocus" }, EDITOR_EVENTS);
    var FORMULAINPUT_EVENTS = $.extend({ focus: "onEditorCellFocus" }, EDITOR_EVENTS);

    var SELECTION_MODES = {
       cell: "range",
       rowheader: "row",
       columnheader: "column",
       topcorner: "sheet",
       autofill: "autofill"
    };

    function toActionSelector(selectors) {
        return selectors.map(function(action) {
            return '[data-action="' + action + '"]';
        }).join(",");
    }

    var COMPOSITE_UNAVAILABLE_ACTION_SELECTORS = toActionSelector([ 'cut', 'copy', 'paste', 'insert-left', 'insert-right', 'insert-above', 'insert-below' ]);
    var UNHIDE_ACTION_SELECTORS = toActionSelector([ 'unhide-row', 'unhide-column' ]);

    var ACTION_KEYS = [];
    var SHIFT_ACTION_KEYS = [];
    var ENTRY_ACTION_KEYS = [];

    for (var key in ACTIONS) {
        ACTION_KEYS.push(key);
        SHIFT_ACTION_KEYS.push("shift+" + key);
    }

    for (key in ENTRY_ACTIONS) {
        ENTRY_ACTION_KEYS.push(key);
    }

    CLIPBOARD_EVENTS[ACTION_KEYS] = "onAction";
    CLIPBOARD_EVENTS[SHIFT_ACTION_KEYS] = "onShiftAction";
    CLIPBOARD_EVENTS[ENTRY_ACTION_KEYS] = "onEntryAction";

    FORMULAINPUT_EVENTS[ACTION_KEYS] = "onEditorAction";
    FORMULAINPUT_EVENTS[SHIFT_ACTION_KEYS] = "onEditorShiftAction";

    var Controller = kendo.Class.extend({
        init: function(view, workbook) {
            this.view = view;
            this.workbook(workbook);
            this.container = $(view.container);
            this.clipboardElement = $(view.clipboard);
            this.cellContextMenu = view.cellContextMenu;
            this.rowHeaderContextMenu = view.rowHeaderContextMenu;
            this.colHeaderContextMenu = view.colHeaderContextMenu;
            this.scroller = view.scroller;
            this.tabstrip = view.tabstrip;
            this.sheetsbar = view.sheetsbar;

            this.editor = view.editor;
            this.editor.bind("change", this.onEditorChange.bind(this));
            this.editor.bind("activate", this.onEditorActivate.bind(this));
            this.editor.bind("deactivate", this.onEditorDeactivate.bind(this));
            this.editor.bind("update", this.onEditorUpdate.bind(this));

            $(view.scroller).on("scroll", this.onScroll.bind(this));
            this.listener = new kendo.spreadsheet.EventListener(this.container, this, CONTAINER_EVENTS);
            this.keyListener = new kendo.spreadsheet.EventListener(this.clipboardElement, this, CLIPBOARD_EVENTS);

            this.barKeyListener = new kendo.spreadsheet.EventListener(this.editor.barElement(), this, FORMULABAR_EVENTS);
            this.inputKeyListener = new kendo.spreadsheet.EventListener(this.editor.cellElement(), this, FORMULAINPUT_EVENTS);

            if (this.sheetsbar) {
                this.sheetsbar.bind("select", this.onSheetBarSelect.bind(this));
                this.sheetsbar.bind("reorder", this.onSheetBarReorder.bind(this));
                this.sheetsbar.bind("rename", this.onSheetBarRename.bind(this));
                this.sheetsbar.bind("remove", this.onSheetBarRemove.bind(this));
            }

            this.cellContextMenu.bind("select", this.onContextMenuSelect.bind(this));
            this.rowHeaderContextMenu.bind("select", this.onContextMenuSelect.bind(this));
            this.colHeaderContextMenu.bind("select", this.onContextMenuSelect.bind(this));

            // this is necessary for Windows to catch prevent context menu correctly
            this.cellContextMenu.element.add(this.rowHeaderContextMenu.element).add(this.colHeaderContextMenu.element).on("contextmenu", false);

            if (this.tabstrip) {
                this.tabstrip.bind("action", this.onCommandRequest.bind(this));
                this.tabstrip.bind("dialog", this.onDialogRequest.bind(this));
            }
        },

        _execute: function(options) {
            var result = this._workbook.execute(options);

            if (options.command === "EditCommand" && !result) {
                this._workbook.trigger("change", { editorClose: true });
            }

            if (result) {
                if (result.reason === "error") {
                    this.view.showError(result);
                } else {
                    this.view.openDialog(result.reason);
                }
            }

            return result;
        },

        _activeTooltip: function() {
            return this._workbook.activeSheet().activeCell().simplify().toString();
        },

        onContextMenuSelect: function(e) {
                var action = $(e.item).data("action");
                var command;
                switch(action) {
                    case "cut":
                        command = { command: "ToolbarCutCommand", options: { workbook: this._workbook } };
                        break;
                    case "copy":
                        command = { command: "ToolbarCopyCommand", options: { workbook: this._workbook } };
                        break;
                    case "paste":
                        command = { command: "ToolbarPasteCommand", options: { workbook: this._workbook } };
                        break;
                    case "unmerge":
                        command = { command: "MergeCellCommand", options: { value: "unmerge" } };
                        break;
                    case "merge":
                        this.view.openDialog("merge");
                        break;
                    case "hide-row":
                        command = { command: "HideLineCommand", options: { axis: "row" } };
                        break;
                    case "hide-column":
                        command = { command: "HideLineCommand", options: { axis: "column" } };
                        break;
                    case "unhide-row":
                        command = { command: "UnHideLineCommand", options: { axis: "row" } };
                        break;
                    case "unhide-column":
                        command = { command: "UnHideLineCommand", options: { axis: "column" } };
                        break;
                    case "delete-row":
                        command = { command: "DeleteRowCommand" };
                        break;
                    case "delete-column":
                        command = { command: "DeleteColumnCommand" };
                        break;
                }

                if (command) {
                    this._execute(command);
                }
        },

        onSheetBarRemove: function(e) {
            var sheet = this._workbook.sheetByName(e.name);

            //TODO: move to model!
            if (!sheet) {
                return;
            }

            this._workbook.removeSheet(sheet);
        },

        destroy: function() {
            this.listener.destroy();
            this.keyListener.destroy();
            this.inputKeyListener.destroy();
        },

        onSheetBarSelect: function(e) {
            var sheet;
            var workbook = this._workbook;

            if (e.isAddButton) {
                sheet = workbook.insertSheet();
            } else {
                sheet = workbook.sheetByName(e.name);
            }

            //TODO: move to model
            if (workbook.activeSheet().name() !== sheet.name()) {
                workbook.activeSheet(sheet);
            }
        },

        onSheetBarReorder: function(e) {
            var sheet = this._workbook.sheetByIndex(e.oldIndex);

            this._workbook.moveSheetToIndex(sheet, e.newIndex);

            this._workbook.activeSheet(sheet);
        },

        onSheetBarRename: function(e) {
            var sheet = this._workbook.sheetByIndex(e.sheetIndex);

            this._workbook.renameSheet(sheet, e.name);

            this.clipboardElement.focus();
        },

        sheet: function(sheet) {
            this.navigator = sheet.navigator();
            this.axisManager = sheet.axisManager();
        },

        workbook: function(workbook) {
            this._workbook = workbook;
            this.clipboard = workbook.clipboard();
            workbook.bind("commandRequest", this.onCommandRequest.bind(this));
        },

        refresh: function() {
            var editor = this.editor;
            var workbook = this._workbook;
            var sheet = workbook.activeSheet();

            this._viewPortHeight = this.view.scroller.clientHeight;
            this.navigator.height(this._viewPortHeight);

            if (!editor.isActive()) {
                editor.enable(sheet.selection().enable() !== false);
                editor.value(workbook._inputForRef(sheet.activeCell()));
            }
        },

        onScroll: function() {
            this.view.render();
        },

        onWheel: function(event) {
            var deltaX = event.originalEvent.deltaX;
            var deltaY = event.originalEvent.deltaY;

            if (event.originalEvent.deltaMode === 1) {
                deltaX *= 10;
                deltaY *= 10;
            }

            this.scrollWith(deltaX, deltaY);

            event.preventDefault();
        },

        onAction: function(event, action) {
            this.navigator.moveActiveCell(ACTIONS[action]);
            event.preventDefault();
        },

        onPageUp: function() {
            this.scrollDown(-this._viewPortHeight);
        },

        onPageDown: function() {
            this.scrollDown(this._viewPortHeight);
        },

        onEntryAction: function(event, action) {
            if (event.mod) {
                var shouldPrevent = true;
                var key = String.fromCharCode(event.keyCode);

                switch(key) {
                    case "A":
                        this.navigator.selectAll();
                        break;
                    case "Y":
                        this._workbook.undoRedoStack.redo();
                        break;
                    case "Z":
                        this._workbook.undoRedoStack.undo();
                        break;
                    default:
                        shouldPrevent = false;
                        break;
                }
                if(shouldPrevent) {
                    event.preventDefault();
                }
            } else {
                var disabled = this._workbook.activeSheet().selection().enable() === false;

                if (action == "delete" || action == "backspace") {
                    if (disabled) { return; }

                    this._execute({ command: "ClearContentCommand" });
                    event.preventDefault();
                } else if (alphaNumRegExp.test(action) || action === ":edit") {
                    if (disabled) { return; }

                    if (action !== ":edit") {
                        this.editor.value("");
                    }

                    this.editor
                        .activate({
                            range: this._workbook.activeSheet()._viewActiveCell(),
                            rect: this.view.activeCellRectangle(),
                            tooltip: this._activeTooltip()
                        })
                        .focus();
                } else {
                    this.navigator.navigateInSelection(ENTRY_ACTIONS[action]);
                    event.preventDefault();
                }
            }
        },

        onShiftAction: function(event, action) {
            this.navigator.modifySelection(ACTIONS[action.replace("shift+", "")], this.appendSelection);
            event.preventDefault();
        },

        onMouseMove: function(event) {
            var sheet = this._workbook.activeSheet();

            if (sheet.resizingInProgress() || sheet.selectionInProgress()) {
                return;
            }

            var object = this.objectAt(event);
            if (object.type === "columnresizehandle" || object.type === "rowresizehandle") {
                sheet.positionResizeHandle(object.ref);
            } else {
                sheet.removeResizeHandle();
            }
        },

        onMouseDown: function(event) {
            var object = this.objectAt(event);

            if (object.pane) {
                this.originFrame = object.pane;
            }

            if (this.editor.canInsertRef(false) && object.ref) {
                this._workbook.activeSheet()._setFormulaSelections(this.editor.highlightedRefs());
                this.navigator.startSelection(object.ref, this._selectionMode, this.appendSelection);
                event.preventDefault();
                return;
            } else {
                this.editor.deactivate();

                if (this.editor.isActive()) {
                    event.preventDefault();
                    return;
                }
            }

            var sheet = this._workbook.activeSheet();
            if (object.type === "columnresizehandle" || object.type === "rowresizehandle") {
                sheet.startResizing({ x: object.x, y: object.y });
                event.preventDefault();
                return;
            }

            if (object.type === "filtericon") {
                this.openFilterMenu(event);
                event.preventDefault();
                return;
            }

            this._selectionMode = SELECTION_MODES[object.type];
            this.appendSelection = event.mod;
            this.navigator.startSelection(object.ref, this._selectionMode, this.appendSelection);
        },

        onContextMenu: function(event) {
            var sheet = this._workbook.activeSheet();

            if (sheet.resizingInProgress()) {
                return;
            }

            event.preventDefault();

            this.cellContextMenu.close();
            this.colHeaderContextMenu.close();
            this.rowHeaderContextMenu.close();

            var menu;

            var location = { pageX: event.pageX, pageY: event.pageY };

            var object = this.objectAt(location);

            if (object.type === "columnresizehandle" || object.type === "rowresizehandle") {
                return;
            }

            this.navigator.selectForContextMenu(object.ref, SELECTION_MODES[object.type]);

            var isComposite = this.navigator._sheet.select() instanceof kendo.spreadsheet.UnionRef;
            var showUnhide = false;
            var showUnmerge = false;

            if (object.type == "columnheader") {
                menu = this.colHeaderContextMenu;
                showUnhide = !isComposite && this.axisManager.selectionIncludesHiddenColumns();
            } else if (object.type == "rowheader") {
                menu = this.rowHeaderContextMenu;
                showUnhide = !isComposite && this.axisManager.selectionIncludesHiddenRows();
            } else {
                menu = this.cellContextMenu;
                showUnmerge = this.navigator.selectionIncludesMergedCells();
            }

            menu.element.find(COMPOSITE_UNAVAILABLE_ACTION_SELECTORS).toggle(!isComposite);
            menu.element.find(UNHIDE_ACTION_SELECTORS).toggle(showUnhide);
            menu.element.find('[data-action=unmerge]').toggle(showUnmerge);

            // avoid the immediate close
            setTimeout(function() {
                menu.open(event.pageX, event.pageY);
            });
        },

        prevent: function(event) {
            event.preventDefault();
        },

        constrainResize: function(type, ref) {
            var sheet = this._workbook.activeSheet();
            var resizeHandle = sheet.resizeHandlePosition();

            return !resizeHandle || type === "outside" || type === "topcorner" || ref.col < resizeHandle.col || ref.row < resizeHandle.row;
        },

        onMouseDrag: function(event) {
            if (this._selectionMode === "sheet") {
                return;
            }

            var location = { pageX: event.pageX, pageY: event.pageY };
            var object = this.objectAt(location);

            var sheet = this._workbook.activeSheet();
            if (sheet.resizingInProgress()) {

                if (!this.constrainResize(object.type, object.ref)) {
                    sheet.resizeHintPosition({ x: object.x, y: object.y });
                }

                return;
            }

            if (object.type === "outside") {
                this.startAutoScroll(object);
                return;
            }

            if (this.originFrame === object.pane) {
                this.selectToLocation(location);
            } else { // cross frame selection
                var frame = this.originFrame._grid;

                if (object.x > frame.right) {
                    this.scrollLeft();
                }

                if (object.y > frame.bottom) {
                    this.scrollTop();
                }

                if (object.y < frame.top || object.x < frame.left) {
                    this.startAutoScroll(object, location);
                } else {
                    this.selectToLocation(location);
                }
            }

            event.preventDefault();
        },

        onMouseUp: function(event) {
            var sheet = this._workbook.activeSheet();
            sheet.completeResizing();

            this.navigator.completeSelection();
            this.stopAutoScroll();

            var editor = this.editor.activeEditor();
            if (!editor) {
                return;
            }
            var el = event.target;
            while (el) {
                if (el === editor.element[0]) {
                    return;
                }
                el = el.parentNode;
            }

            var object = this.objectAt(event);
            if (object && object.ref && editor.canInsertRef(false)) {
                editor.refAtPoint(sheet.selection()._ref);
                sheet._setFormulaSelections(editor.highlightedRefs());
            }
        },

        onDblClick: function(event) {
            var object = this.objectAt(event);
            var disabled = this._workbook.activeSheet().selection().enable() === false;

            if (object.type !== "cell" || disabled) {
                return;
            }

            this.editor
                .activate({
                    range: this._workbook.activeSheet()._viewActiveCell(),
                    rect: this.view.activeCellRectangle(),
                    tooltip: this._activeTooltip()
                })
                .focus();

            this.onEditorUpdate();
        },

        onCut: function(e) {
            if(e){
                var table = this.clipboardElement.find("table.kendo-clipboard-"+ this.clipboard._uid).detach();
                this.clipboardElement.append(table.clone(false));
                setTimeout(function() {
                    this.clipboardElement.empty().append(table);
                }.bind(this));
            }

            this._execute({
                command: "CutCommand",
                options: { workbook: this.view._workbook }
            });
        },

        clipBoardValue: function() {
            return this.clipboardElement.html();
        },

        onPaste: function(e) {
            var html = "";
            var plain = "";
            this.clipboard.menuInvoked = (e === undefined);
            if(e) {
                if (e.originalEvent.clipboardData && e.originalEvent.clipboardData.getData) {
                    e.preventDefault();
                    var hasHTML = false;
                    var hasPlainText = false;
                    //Firefox uses DOMStringList, needs special handling
                    if(window.DOMStringList && e.originalEvent.clipboardData.types instanceof window.DOMStringList) {
                        hasHTML = e.originalEvent.clipboardData.types.contains("text/html");
                        hasPlainText = e.originalEvent.clipboardData.types.contains("text/plain");
                    } else {
                        hasHTML = (/text\/html/.test(e.originalEvent.clipboardData.types));
                        hasPlainText = (/text\/plain/.test(e.originalEvent.clipboardData.types));
                    }
                    if (hasHTML) {
                        html = e.originalEvent.clipboardData.getData('text/html');
                    }
                    if (hasPlainText) {
                        plain = e.originalEvent.clipboardData.getData('text/plain').trim();
                    }
                } else {
                    //workaround for IE's lack of access to the HTML clipboard data
                    var table = this.clipboardElement.find("table.kendo-clipboard-"+ this.clipboard._uid).detach();
                    this.clipboardElement.empty();
                    setTimeout(function() {
                        var html = this.clipboardElement.html();
                        var plain = window.clipboardData.getData("Text").trim();
                        if(!html && !plain) {
                            return;
                        }
                        this.clipboard.external({html: html, plain: plain});
                        this.clipboardElement.empty().append(table);
                        this._execute({
                            command: "PasteCommand",
                            options: { workbook: this.view._workbook }
                        });
                        this.clipboard.menuInvoked = true;
                    }.bind(this));
                    return;
                }
            } else {
                if(kendo.support.browser.msie) {
                    this.clipboardElement.focus().select();
                    document.execCommand('paste');
                    return;
                } else {
                    this.clipboard.menuInvoked = true;
                }
            }

            if(!html && !plain) {
                return;
            }
            this.clipboard.external({html: html, plain:plain});
            this._execute({
                command: "PasteCommand",
                options: { workbook: this.view._workbook }
            });

        },

        onCopy: function(e) {
            this.clipboard.menuInvoked = (e === undefined);
            this._execute({
                command: "CopyCommand",
                options: { workbook: this.view._workbook }
            });
        },

////////////////////////////////////////////////////////////////////

        scrollTop: function() {
            this.scroller.scrollTop = 0;
        },

        scrollLeft: function() {
            this.scroller.scrollLeft = 0;
        },

        scrollDown: function(value) {
            this.scroller.scrollTop += value;
        },

        scrollRight: function(value) {
            this.scroller.scrollLeft += value;
        },

        scrollWith: function(right, down) {
            this.scroller.scrollTop += down;
            this.scroller.scrollLeft += right;
        },

        objectAt: function(location) {
            var offset = this.container.offset();
            var coordinates = {
                left: location.pageX - offset.left,
                top: location.pageY - offset.top
            };

            return this.view.objectAt(coordinates.left, coordinates.top);
        },

        selectToLocation: function(cellLocation) {
            var object = this.objectAt(cellLocation);

            if (object.pane) { // cell, rowheader or columnheader
                this.extendSelection(object);
                this.lastKnownCellLocation = cellLocation;
                this.originFrame = object.pane;
            }

            this.stopAutoScroll();
        },

        extendSelection: function(object) {
            this.navigator.extendSelection(object.ref, this._selectionMode, this.appendSelection);
        },

        autoScroll: function() {
            var x = this._autoScrollTarget.x;
            var y = this._autoScrollTarget.y;
            var boundaries = this.originFrame._grid;
            var scroller = this.view.scroller;
            var scrollStep = 8;

            var scrollLeft = scroller.scrollLeft;
            var scrollTop = scroller.scrollTop;

            if (x < boundaries.left) {
                this.scrollRight(-scrollStep);
            }
            if (x > boundaries.right) {
                this.scrollRight(scrollStep);
            }
            if (y < boundaries.top) {
                this.scrollDown(-scrollStep);
            }
            if (y > boundaries.bottom) {
                this.scrollDown(scrollStep);
            }

            if (scrollTop === scroller.scrollTop && scrollLeft === scroller.scrollLeft) {
                this.selectToLocation(this.finalLocation);
            } else {
                this.extendSelection(this.objectAt(this.lastKnownCellLocation));
            }
        },

        startAutoScroll: function(viewObject, location) {
            if (!this._scrollInterval) {
                this._scrollInterval = setInterval(this.autoScroll.bind(this), 50);
            }

            this.finalLocation = location || this.lastKnownCellLocation;

            this._autoScrollTarget = viewObject;
        },

        stopAutoScroll: function() {
            clearInterval(this._scrollInterval);
            this._scrollInterval = null;
        },

        openFilterMenu: function(event) {
            var object = this.objectAt(event);
            var sheet = this._workbook.activeSheet();
            var column = sheet.filterColumn(object.ref);
            var filterMenu = this.view.createFilterMenu(column);

            filterMenu.bind("action", this.onCommandRequest.bind(this));
            filterMenu.bind("action", filterMenu.close.bind(filterMenu));

            filterMenu.openFor(event.target);
        },

////////////////////////////////////////////////////////////////////

        onEditorChange: function(e) {
            this._workbook.activeSheet().isInEditMode(false);

            var result = this._execute({
                command: "EditCommand",
                options: {
                    editActiveCell: true,
                    value: e.value
                }
            });

            if (result && result.reason === "error") {
                e.preventDefault();
            }
        },

        onEditorActivate: function() {
            var workbook = this._workbook;
            var sheet = workbook.activeSheet();

            sheet._setFormulaSelections(this.editor.highlightedRefs());
            sheet.isInEditMode(true);
        },

        onEditorDeactivate: function() {
            var sheet = this._workbook.activeSheet();

            sheet.isInEditMode(false);
            sheet._setFormulaSelections([]);
        },

        onEditorUpdate: function() {
            this._workbook.activeSheet()._setFormulaSelections(this.editor.highlightedRefs());
        },

        onEditorBarFocus: function() {
            var disabled = this._workbook.activeSheet().selection().enable() === false;
            if (disabled) {
                return;
            }
            this.editor
                .activate({
                    range: this._workbook.activeSheet()._viewActiveCell(),
                    rect: this.view.activeCellRectangle(),
                    tooltip: this._activeTooltip()
                });
        },

        onEditorCellFocus: function() {
            this.editor.scale();
        },

        onEditorEsc: function() {
            this.editor.value(this._workbook._inputForRef(this._workbook.activeSheet()._viewActiveCell()));
            this.editor.deactivate();

            this.clipboardElement.focus();
        },

        insertNewline: function(e) {
            e.preventDefault();
            this.editor.insertNewline();
        },

        onEditorBlur: function(_, action) {
            if (this.editor.isFiltered()) {
                return;
            }

            this.editor.deactivate();

            if (!this.editor.isActive()) {
                this.clipboardElement.focus();
                this.navigator.navigateInSelection(ENTRY_ACTIONS[action]);
            }
        },

        onEditorAction: function(event, action) {
            var editor = this.editor;
            var sheet = this._workbook.activeSheet();

            if (editor.canInsertRef(true)) {
                this.navigator.moveActiveCell(ACTIONS[action]);

                editor.activeEditor().refAtPoint(sheet.selection()._ref);
                sheet._setFormulaSelections(editor.highlightedRefs());

                event.preventDefault();
            }
        },

        onEditorShiftAction: function(event, action) {
            var editor = this.editor;
            var sheet = this._workbook.activeSheet();

            if (editor.canInsertRef(true)) {
                this.navigator.modifySelection(ACTIONS[action.replace("shift+", "")], this.appendSelection);

                editor.activeEditor().refAtPoint(sheet.selection()._ref);
                sheet._setFormulaSelections(editor.highlightedRefs());

                event.preventDefault();
            }
        },

////////////////////////////////////////////////////////////////////

        onCommandRequest: function(e) {
            if (e.command) {
                this._execute(e);
            } else {
                this._workbook.undoRedoStack[e.action]();
            }
        },

        onDialogRequest: function(e) {
            var exportOptions = {
                pdfExport: this._workbook.options.pdf,
                excelExport: this._workbook.options.excel
            };
            if(e.options) {
                $.extend(true, e.options, exportOptions);
            } else {
                e.options = exportOptions;
            }
            this.view.openDialog(e.name, e.options);
        }
    });

    kendo.spreadsheet.Controller = Controller;
})(window.kendo);

}, typeof define == 'function' && define.amd ? define : function(a1, a2, a3){ (a3 || a2)(); });