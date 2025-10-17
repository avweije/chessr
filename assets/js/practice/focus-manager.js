import { FocusBoardGroup } from "focus-group";
import { FocusBoard } from "focus-board";

/**
 * The manager for the focus boards.
 * 
 * Uses the focus board groups and focus boards.
 * 
 * Handles the overall stuff, moving between groups? Rendering?
 * 
 * Groups contain .render() function, but we have to create the containers for it and call it all.
 * 
 * This class will be called/used after the other container is toggled.
 * 
 * Option to run practice, which toggles board/other containers.
 * On stopPractice, we need to switch back to the side by side view.
 * 
 * - load(focused, groups?) : loads the groups and boards
 * 
 * 
 * After load function, I think we handle everything here?
 * 
 * Actions are on the boards and groups.
 * 
 * Global actions are? Maybe something like show notes, hide notes?
 * 
 */
export class FocusBoardManager {
    focused = null;
    boardSettings = null;
    practiceClass = null;

    container = null;
    groups = [];

    constructor(focused, boardSettings, practiceClass) {
        // Store a copy of the focused array
        this.focused = focused.slice(0);
        // Store the board settings
        this.boardSettings = boardSettings;
        // Store the practice class for reference
        this.practiceClass = practiceClass;
        // Get the container for the groups
        this.container = document.getElementById('boardPageOtherContainer');
        // Add the class name
        this.container.className = 'mt-6';
        // Get the elements
        this.getElements();
        // Initialize the modals
        this.initModals();
        // Load the groups
        this.loadGroups();
        // Add the event listeners
        this.addListeners();
    }

    // Get the required elements
    getElements() {
        // Get the data-elements for reference
        this.elements = {};
        document.querySelectorAll("[data-element]").forEach(el => {
            if (el.dataset.element !== "yes") return;
            this.elements[el.id] = el;
        });

        // get the practice type
        this.type = this.elements.board.getAttribute("data-type");
        // get the repertoire id (from the roadmap)
        this.repertoireId = this.elements.board.getAttribute("data-id");
    }

    initModals() {
        // Unfocus modal
        this.showUnfocusModal = () => {
            // Make sure we know we are showing it
            this._unfocusModalShown = true;
            // Show the unfocus modal
            this.elements.unfocusModal.classList.add("is-active");
        };
        this.closeUnfocusModal = () => {
            // Only if we are showing it
            if (!this._unfocusModalShown) return;
            // Hide the unfocus modal
            this.elements.unfocusModal.classList.remove("is-active");
        };

        const unfocusModalBkgd = this.elements.unfocusModal.getElementsByClassName("modal-background")[0];

        unfocusModalBkgd.addEventListener("click", this.closeUnfocusModal);
        this.elements.unfocusModalCloseButton.addEventListener("click", this.closeUnfocusModal);
        this.elements.unfocusModalCancelButton.addEventListener("click", this.closeUnfocusModal);
        this.elements.unfocusModalConfirmButton.addEventListener("click", () => {
            // Only if we are showing it
            if (!this._unfocusModalShown) return;
            // Handle the confirmation
            this.onUnfocusModalConfirm();
        });
    }

    loadGroups() {
        // Get the main group items and the grouped items
        const groups = this.getMainAndGroups(this.focused);

        console.log('loadGroups:', this.focused, groups);

        // Create the groups
        for (const [key, groupItems] of Object.entries(groups)) {
            // Create the group
            const group = new FocusBoardGroup(this.container, key === 'main', groupItems, this.boardSettings);
            // Add it
            this.container.appendChild(group.getElement());
            this.groups.push(group);
            // Toggle the connect/disconnect buttons.
            group.toggleBoardButtons(false);
        }
    }

    getMainAndGroups(items) {
        const itemsById = Object.fromEntries(items.map(i => [i.id, i]));
        const childrenMap = {};

        // Map parents to direct children
        for (const item of items) {
            if (item.focusedParent != null && itemsById[item.focusedParent]) {
                if (!childrenMap[item.focusedParent]) childrenMap[item.focusedParent] = [];
                childrenMap[item.focusedParent].push(item);
            }
        }

        const groups = {};
        const mainGroup = [];

        for (const item of items) {
            const isParent = !!childrenMap[item.id];
            const isChild = item.focusedParent != null;

            if (isParent) {
                groups[item.id] = [item, ...childrenMap[item.id]];
            } else if (!isChild) {
                // Not a parent, not a child, goes to main
                mainGroup.push(item);
            }
        }

        if (mainGroup.length > 0) {
            groups["main"] = mainGroup;
        }

        return groups;
    }

    addListeners() {
        // In manager (only once, at the top container)
        this.container.addEventListener("FocusBoard:select", e => {
            // Handle the board selection
            this.onSelectBoard(e.detail.group, e.detail.board);
        });

        // In manager (only once, at the top container)
        this.container.addEventListener("FocusBoard:deselect", e => {
            // Handle the board deselection
            this.onDeselectBoard(e.detail.group, e.detail.board);
        });

        // Connect board
        this.container.addEventListener("FocusBoard:connect", e => {
            // Handle the board connection
            this.onConnectBoard(e.detail.group, e.detail.board);
        });

        // Disconnect board
        this.container.addEventListener("FocusBoard:disconnect", e => {
            // Handle the board disconnection
            this.onDisconnectBoard(e.detail.group, e.detail.board);
        });

        // Unfocus board (remove from focus moves)
        this.container.addEventListener("FocusBoard:unfocus", e => {

            console.log('FocusBoardManager: Unfocus requested:', e.detail.group, e.detail.board);

            // Handle the board removal
            this.onUnfocusBoard(e.detail.group, e.detail.board);
        });

        // Notes update
        this.container.addEventListener("FocusBoard:notes", e => {
            // Update the notes
            this.saveFocusedNotes(e.detail);
        });
    }


    /* Update notes in case of edits */

    updateNotes(updated) {
        for (let i = 0; i < this.groups.length; i++) {
            for (let y = 0; y < this.groups[i].boards.length; y++) {
                for (let z = 0; z < updated.length; z++) {
                    if (updated[z].id === this.groups[i].boards[y].move.id) {
                        this.groups[i].boards[y].move.notes = updated[z].notes;
                        this.groups[i].boards[y].elements.notes.textArea.value = updated[z].notes;
                    }
                }
            }
        }
    }


    /* Select/Deselect */

    onSelectBoard(group, board) {
        // Unselect other groups
        for (let i = 0; i < this.groups.length; i++) {
            // Skip active group
            if (group === this.groups[i]) continue;
            // Unselect all
            this.groups[i].deselectAll();
            // Toggle connect/disconnect buttons
            this.groups[i].toggleBoardButtons(board !== null);
        }
    }

    onDeselectBoard(group, board) {
        // Toggle connect buttons
        for (let i = 0; i < this.groups.length; i++) {
            // Skip active group
            if (group === this.groups[i]) continue;
            // Toggle connect/disconnect buttons
            this.groups[i].toggleBoardButtons(false);
        }
    }


    /* Connect/Disconnect */

    onConnectBoard(group, board) {
        // Get the selected group
        let selectedGroup = this.getSelectedGroup();
        if (selectedGroup === null) return;

        // Get the selected board
        const selectedBoard = selectedGroup.getSelectedBoard();

        // Remove board from group
        const remaining = group.removeBoard(board);
        // Remove the group if only 1 board remaining
        if (remaining === 1 && !group.isMainGroup) {
            // Add the board to the main group
            this.addBoardToMainGroup(group.boards[0]);
            // Remove the group
            this.removeGroup(group);
        }
        // Remove the main group if none left
        if (remaining === 0 && group.isMainGroup) {
            // Remove the group
            this.removeGroup(group);
        }

        // The items we need to update in the database
        const items = [];

        // If the selected board is in the main group
        if (selectedGroup.isMainGroup) {
            // Remove the selected board from the main group
            selectedGroup.removeBoard(selectedBoard);
            // Get the board moves
            const groupItems = [selectedBoard.move, board.move];
            // Create the group
            const group = this.createGroup(groupItems);
            // Select the board that was selected
            group.selectBoard(group.boards[0]);
            // Toggle the connect/disconnect buttons
            group.toggleBoardButtons(true);

            // Add both repertoire items to the DB update
            items.push({
                id: selectedBoard.move.id,
                focusedParent: null
            });
            items.push({
                id: board.move.id,
                focusedParent: selectedBoard.move.id
            });
        } else {
            // Add board to selected group
            selectedGroup.addBoard(board);
            // Toggle the connect/disconnect buttons
            selectedGroup.toggleBoardButtons(true);
            // Get the 1st repertoire item in the group
            const firstItem = selectedGroup.focused[0];
            // Add the repertoire item to the DB update
            items.push({
                id: board.move.id,
                focusedParent: firstItem.id
            });
        }

        // Save the changes to the database
        this.saveFocusedParent(items);
    }

    onDisconnectBoard(group, board, unfocus = false) {
        // Safety check
        if (group === null || (group.isMainGroup && !unfocus)) return;

        // The items that need to be updated in the database
        const items = [];
        // Remove board from group
        const remaining = group.removeBoard(board);

        // Ungroup the board (DB)
        let item = {
            id: board.move.id,
            focusedParent: null
        };
        // If we need to remove from focus moves, set focused = false
        if (unfocus) item.focused = false;
        items.push(item);

        console.log('Item:', item);

        // Remove the group if only 1 board remaining
        if (remaining === 1 && !group.isMainGroup) {
            // Add the board to the main group
            this.addBoardToMainGroup(group.boards[0]);

            // Ungroup the 1st board also (DB)
            items.push({
                id: group.boards[0].move.id,
                focusedParent: null
            });
        } else if (remaining > 1 && !unfocus) {

            // If the removed board was the 1st board, that was the parent for the group
            // In that case, we need to update the parentIds to the id of the (newly) 1st item

            // If the 1st item is not the parent
            if (group.focused[0].focusedParent !== null) {
                group.focused[0].focusedParent = null;

                // Add to the items to update in the database
                items.push({
                    id: group.focused[0].id,
                    focusedParent: null
                });
            }

            // Check if the parent is correct and update if needed
            for (let i = 1; i < group.focused.length; i++) {
                if (group.focused[i].focusedParent !== group.focused[0].id) {
                    group.focused[i].focusedParent = group.focused[0].id;

                    // Add to the items to update in the database
                    items.push({
                        id: group.focused[i].id,
                        focusedParent: group.focused[0].id
                    });
                }
            }
        }

        // Remove the group if needed
        if (remaining === 0 || (remaining === 1 && !group.isMainGroup)) {
            // Remove the group
            this.removeGroup(group);
        }

        // Add to the main group, unless we are removing it from the focus moves
        if (!unfocus) this.addBoardToMainGroup(board);
        // Toggle the connect/disconnect buttons
        const mainGroup = this.getMainGroup();
        if (mainGroup) mainGroup.toggleBoardButtons(this.getSelectedBoard() !== null);

        // Save the changes to the database
        this.saveFocusedParent(items);
    }

    onUnfocusBoard(group, board) {
        // Store the group & board
        this.unfocusGroup = group;
        this.unfocusBoard = board;
        // Ask for confirmation
        this.showUnfocusModal();
    }

    onUnfocusModalConfirm() {
        // Hide the modal
        this.closeUnfocusModal();
        // Disconnect & remove the board
        this.onDisconnectBoard(this.unfocusGroup, this.unfocusBoard, true);
    }


    /* Groups */

    createGroup(focused) {
        // Create the focus group
        const group = new FocusBoardGroup(this.container, false, focused, this.boardSettings);
        // Add as 1st group in the container
        this.container.insertBefore(group.getElement(), this.container.firstElementChild);
        // Add to array
        this.groups.push(group);

        return group;
    }

    removeGroup(group) {
        // Find the group
        const idx = this.groups.indexOf(group);

        if (idx === -1) return false;

        // Remove the group element from page
        const groupElement = group.getElement();
        groupElement.parentNode.removeChild(groupElement);
        // Remove the group
        this.groups.splice(idx, 1);

        return this.groups.length;
    }


    /* Main group */

    createMainGroup(focused = []) {
        // Create the main group
        const group = new FocusBoardGroup(this.container, true, focused, this.boardSettings);
        // Add to our groups array
        this.groups.push(group);
        // Add the main group to the container
        this.container.appendChild(group.getElement());

        return group;
    }

    addBoardToMainGroup(board) {
        // Get the main group
        let mainGroup = this.getMainGroup();

        // If no main group, create it
        if (mainGroup === null) {
            mainGroup = this.createMainGroup();
        }
        // Add the board
        mainGroup.addBoard(board);
    }


    /* Helper functions */

    getSelectedGroup() {
        // Get the selected group
        for (let i = 0; i < this.groups.length; i++) {
            if (this.groups[i].isSelected()) {
                return this.groups[i];
            }
        }
        return null;
    }

    getSelectedBoard() {
        const selectedGroup = this.getSelectedGroup();
        return selectedGroup?.getSelectedBoard() ?? null;
    }

    getMainGroup() {
        // Get the main group
        for (let i = 0; i < this.groups.length; i++) {
            if (this.groups[i].isMainGroup) {
                return this.groups[i];
            }
        }
        return null;
    }

    saveFocusedParent(items) {
        // The repertoire needs to be refreshed after this change
        this.practiceClass.needsRefresh = true;
        // Set the endpoint
        const url = "/api/repertoire/focused/parent";

        const data = {
            items: items
        };

        // (Dis)connect the repertoire items
        fetch(url, {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((res) => res.json())
            .then((response) => {
                console.log("Success:");
                console.log(response);
            })
            .catch((err) => {
                console.warn("Error:", err);
                // Show the error toast
                Utils.showError(err);
            });
    }

    saveFocusedNotes(item) {
        // Set the endpoint
        const url = "/api/repertoire/details";

        console.log('Saving notes:', item);

        // Safety check
        if (!item || !item.id) return;

        const data = {
            id: item.id,
            notes: item.notes
        };

        // (Dis)connect the repertoire items
        fetch(url, {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((res) => res.json())
            .then((response) => {
                console.log("Success:");
                console.log(response);
            })
            .catch((err) => {
                console.warn("Error:", err);
                // Show the error toast
                Utils.showError(err);
            });
    }
}