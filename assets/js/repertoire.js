import { MyChess } from "chess";
import { BOARD_STATUS, MyChessBoard, PIECE_TILESIZE } from "chessboard";
import { MARKER_TYPE } from "../vendor/cm-chessboard/src/extensions/markers/Markers.js";
import { COLOR } from "../vendor/cm-chessboard/src/view/ChessboardView.js";
import { Utils } from "utils";
import { UCI } from "uci";
import { EngineHelper } from "EngineHelper";

import "../styles/chessboard.css";

class Repertoire extends MyChessBoard {
  currentFen = "";
  currentTurn = "";
  engineFen = "";
  previewMove = "";

  color = "white";

  pgnLoaded = false;

  engineHelper = null;
  uci = null;

  cache = [];

  repertoireId = 0;
  repertoireAutoPlay = false;
  repertoireExclude = false;
  repertoireIncluded = true;
  groups = [];
  repertoireGroups = [];

  initialFensLoaded = false;

  confirmDialog = {};
  loadPgnDialog = {};

  settings = null;

  constructor() {
    super();

    // show the page loader
    Utils.showLoading();

    // Create the EngineHelper instance
    this.engineHelper = new EngineHelper();

    // Get the elements
    this.getElements();
    // Add the listeners
    this.addListeners();

    // get the repertoire color
    this.color = this.elements.board.getAttribute("data-color");

    // Set the PgnField options
    this.setPgnOptions({ highlightLastMove: false });
    // set the pgn field
    this.setPgnField(this.elements.pgnField);

    // get the settings (and then create the board)
    this.getSettings();
    // get the groups
    this.getGroups();

    // enable the load pgn button
    this.elements.loadPgnButton.disabled = false;

    // initialise the modals
    this.initModals();

    // hide the page loader
    Utils.hideLoading();
  }

  // Uses the data-element attribute to gather all the elements needed for this JS file
  getElements() {
    // Get the data-elements for reference
    this.elements = {};
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      this.elements[el.id] = el;
    });
  }

  // Add event listeners
  addListeners() {
    // Repertoire color
    this.elements.whiteRepertoireRadio.addEventListener(
      "click", this.onRepertoireColorSwitch.bind(this));
    this.elements.blackRepertoireRadio.addEventListener(
      "click", this.onRepertoireColorSwitch.bind(this));

    // Engine toggle
    this.elements.engineCheckbox.addEventListener(
      "click", this.onEngineToggle.bind(this));

    // Inital FEN (unused?)
    this.elements.initialFenSelect.addEventListener(
      "change", this.onSelectInitialFen.bind(this));

    // Pgn goto first
    this.elements.gotoFirstButton.addEventListener("click", this.onGotoFirst.bind(this));
    // Pgn load/close
    this.elements.loadPgnButton.addEventListener("click", this.onLoadPgn.bind(this));
    this.elements.closePgnButton.addEventListener("click", this.onClosePgn.bind(this));

    // Repertoire buttons
    this.elements.saveRepertoireButton.addEventListener(
      "click", this.onSaveRepertoire.bind(this));

    this.elements.analyseGameButton.addEventListener(
      "click", this.onAnalyseGame.bind(this));

    // Repertoire details
    this.elements.repertoireAutoPlayCheckbox.addEventListener(
      "change", this.onRepertoireAutoPlayChange.bind(this));

    this.elements.repertoireExcludeCheckbox.addEventListener(
      "change",
      this.onRepertoireExcludeChange.bind(this)
    );

    // Repertoire group
    this.elements.repertoireGroupInput.addEventListener(
      "input", this.onRepertoireGroupInput.bind(this));
    this.elements.repertoireGroupInput.addEventListener(
      "keydown", this.onRepertoireGroupKeyDown.bind(this));

    // Remove button
    this.elements.removeRepertoireButton.addEventListener(
      "click", this.onRemoveRepertoireClick.bind(this));
  }

  // Creates the chessboard, removes skeleton loader
  createChessboard() {
    // The board settings
    const boardSettings = {
      orientation: this.color == "white" ? COLOR.white : COLOR.black,
      style: {
        pieces: {},
      },
    };
    // TODO: needs improving..
    if (this.settings.board) {
      boardSettings.style.cssClass = this.settings.board;
    }
    if (this.settings.pieces) {
      boardSettings.style.pieces.file = "pieces/" + this.settings.pieces;
      boardSettings.style.pieces.tileSize = PIECE_TILESIZE.get(this.settings.pieces);
    }
    if (this.settings.animation) {
      boardSettings.style.animationDuration = this.settings.animation;
    }

    // Create the chessboard
    this.init(this.elements.board, boardSettings, {
      useVariations: false,
      navigationEnabled: true,
    });

    // Remove the skeleton loader
    this.elements.board.parentNode.removeChild(this.elements.board.previousElementSibling);
  }

  // Initialise the modals
  initModals() {
    // Confirm Modal
    const confirmModal = document.getElementById("confirmModal");
    const confirmModalBkgd = confirmModal.getElementsByClassName("modal-background")[0];
    const confirmClose = document.getElementById("confirmModalCloseButton");
    const confirmCancel = document.getElementById("confirmModalCancelButton");
    const confirmButton = document.getElementById("confirmModalConfirmButton");

    const showConfirmModal = () => confirmModal.classList.add("is-active");
    const closeConfirmModal = () => confirmModal.classList.remove("is-active");

    confirmModalBkgd.addEventListener("click", closeConfirmModal);
    confirmClose.addEventListener("click", closeConfirmModal);
    confirmCancel.addEventListener("click", closeConfirmModal);
    confirmButton.addEventListener("click", () => {
      this.onRemoveLineConfirmed();
      closeConfirmModal();
    });

    this.confirmDialog = {
      modal: confirmModal,
      closeButton: confirmClose,
      cancelButton: confirmCancel,
      confirmButton: confirmButton,
      showModal: showConfirmModal,
      closeModal: closeConfirmModal,
    };

    // Load Pgn Modal
    const loadPgnModal = document.getElementById("loadPgnModal");
    const loadPgnModalBkgd = loadPgnModal.getElementsByClassName("modal-background")[0];
    const loadPgnClose = document.getElementById("loadPgnModalCloseButton");
    const loadPgnCancel = document.getElementById("loadPgnModalCancelButton");
    const loadPgnConfirm = document.getElementById("loadPgnModalConfirmButton");
    const loadPgnTextarea = document.getElementById("loadPgnModalPgnTextArea");

    const showLoadPgnModal = () => loadPgnModal.classList.add("is-active");
    const closeLoadPgnModal = () => loadPgnModal.classList.remove("is-active");

    loadPgnModalBkgd.addEventListener("click", closeLoadPgnModal);
    loadPgnClose.addEventListener("click", closeLoadPgnModal);
    loadPgnCancel.addEventListener("click", closeLoadPgnModal);
    loadPgnConfirm.addEventListener("click", () => {
      this.onLoadPgnConfirmed();
      closeLoadPgnModal();
    });

    this.loadPgnDialog = {
      modal: loadPgnModal,
      closeButton: loadPgnClose,
      cancelButton: loadPgnCancel,
      confirmButton: loadPgnConfirm,
      pgnTextarea: loadPgnTextarea,
      showModal: showLoadPgnModal,
      closeModal: closeLoadPgnModal,
    };

    this.showConfirmModal = showConfirmModal;
    this.closeConfirmModal = closeConfirmModal;

    this.showLoadPgnModal = showLoadPgnModal;
    this.closeLoadPgnModal = closeLoadPgnModal;
  }

  // Get the settings
  getSettings() {
    // show the page loader
    Utils.showLoading();

    const url = "/api/settings";
    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        // store the settings
        this.onGetSettings(response.settings);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  // After getting the settings, we can create the chessboard
  // If the repertoire is started for a certain FEN or line
  // We can move to that position
  onGetSettings(settings) {
    // store the settings
    this.settings = settings;

    // Set the EngineHelper options
    this.engineHelper.setOptions({
        duration: this.settings.repertoire_engine_time * 1000,
        onReceive: this.onEngineInfo.bind(this)
    });

    // get the repertoire initial fen & line (in case we need to jump to a certain position through a POST)
    const fen = this.elements.board.getAttribute("data-fen");
    let line = this.elements.board.getAttribute("data-line");

    line = line && line != "" ? line.split(",") : [];

    // Create the chessboard
    this.createChessboard();

    // if we have a position we need to jump to
    if (line.length > 0) {
      // make the moves
      try {
        for (let i = 0; i < line.length; i++) {
          // make the move
          this.game.move(line[i]);
        }
        // update the board
        this.board.setPosition(this.game.fen());
        // set the new position
        this.resetToCurrent(fen);
      } catch (err) {
        console.log(err);
        // reset the game
        this.game.reset();
      }
    }

    // set the board status
    this.setStatus(BOARD_STATUS.waitingOnMove);
    // enable move input
    this.enableMoveInput();
    // update the status
    this.updateStatus();
  }

  // Color switch handler
  onRepertoireColorSwitch() {
    // get the color
    const color = this.elements.whiteRepertoireRadio.checked ? "white" : "black";

    // if switched
    if (color != this.color) {
      // reset the board
      this.game.reset();
      this.board.setPosition(this.game.fen());
      // remove the markers
      this.board.removeMarkers();
      // set the orientation
      const orient = color == "black" ? COLOR.black : COLOR.white;
      if (this.board.getOrientation() != orient) {
        this.board.setOrientation(orient);
      }

      // update the current color
      this.color = color;
      // set the new position
      this.resetToCurrent("");
      // reset the cache
      this.resetCache();
      // update the status & get the moves
      this.updateStatus();
    }
  }

  // Pgn goto first move
  onGotoFirst(event) {
    // goto the 1st move
    this.gotoFirst();
  }

  // Show the pgn load modal
  onLoadPgn(event) {
    console.log("onLoadPgn:");

    console.log(this.loadPgnDialog.pgnTextarea.value);

    // Clear the textarea
    this.loadPgnDialog.pgnTextarea.value = "";

    // Show the modal
    this.showLoadPgnModal();
  }

  // Load the pgn into the repertoire
  onLoadPgnConfirmed() {
    console.log("onLoadPgnConfirmed:");
    console.log(this.loadPgnDialog.pgnTextarea.value);

    // close the modal
    this.closeLoadPgnModal();

    // parse the PGN
    this.parsePgn(this.loadPgnDialog.pgnTextarea.value);
  }

  // Close the pgn and restore the normal repertoire
  onClosePgn(event) {
    console.log("onClosePgn:");

    // turn off variations, reset to current position
    this.settings.useVariations = false;
    this.resetToCurrent(this.initialFen);

    // hide elements
    this.pgnStartPositionContainer.classList.add("is-hidden");
    this.elements.closePgnButton.classList.add("is-hidden");

    // turn off pgn mode
    this.pgnLoaded = false;
  }

  /**
   * Used in Load Pgn Modal. Needs testing for variations.
   * Perhaps look for existing library that parses PGN's with variations.
   * 
   * @param {string} pgnText - The PGN string.
   */
  parsePgn(pgnText) {
    console.log("parsePgn:");

    //
    pgnText = pgnText.replace(new RegExp("\r?\n", "g"), "\n");
    pgnText = pgnText.replace(new RegExp("\\(", "g"), "( ");
    pgnText = pgnText.replace(new RegExp("\\)", "g"), " )");

    console.log(pgnText);

    //
    const fen = "";
    const lines = pgnText.split("\n");

    console.log(lines);

    let pgnMoves = "";
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].charAt(0) == "[") {
        //list($key, $val) = explode(' ', $line, 2);
        //$key = strtolower(trim($key, '['));
        //$val = trim($val, '"]');
        const parts = lines[i].substring(1, lines[i].length - 1).split(" ", 2);
        if (parts[0].toLowerCase() == "fen") {
          console.log("FEN parts:");
          console.log(parts);

          fen = lines[i].substring(6, lines[i].length - 2);

          console.log("FEN found: " + fen);
        }
        continue;
      }

      pgnMoves += lines[i];
    }

    const parts = pgnMoves.split(" ");

    const moves = [];
    const vars = [];
    let currvar = -1;
    let movenr = 1;

    for (let i = 0; i < parts.length; i++) {
      switch (parts[i].charAt(0)) {
        case " ":
        case "\b":
        case "\f":
        case "\n":
        case "\r":
        case "\t":
          break;

        case ";":
          // TODO:  add support for "rest of line" comment.  http://www6.chessclub.com/help/PGN-spec
          break;

        case "{":
          break;

        case "(":
          //_openNewVariation(game, isContinuation);

          const vmovenr =
            currvar == -1
              ? movenr - 1
              : vars[currvar].moveNr + vars[currvar].moves.length - 1;

          vars.push({
            parent: currvar,
            moveNr: vmovenr,
            moves: [],
          });

          currvar = vars.length - 1;
          break;
        case ")":
          currvar = vars[currvar].parent;
          break;
        case "$":
          break;
        case "*":
          break;
        default:
          const moveNumberRegex = /\d+\.+/;
          if (moveNumberRegex.exec(parts[i])) {
            continue;
          }

          if (currvar == -1) {
            moves.push(parts[i]);
            movenr++;
          } else {
            vars[currvar].moves.push(parts[i]);
          }

          break;
      }
    }

    //
    if (moves.length > 0) {
      let valid = true;

      const history = [];
      const variations = [];

      const game = new MyChess();

      // validate the moves
      try {
        // load the FEN (empty or initial setup)
        if (fen != "") {
          game.load(fen);
        }
        //
        for (let i = 0; i < moves.length; i++) {
          game.move(moves[i]);

          history.push(game.history({ verbose: true }).pop());
        }

        game.reset();
        if (fen != "") {
          game.load(fen);
        }

        for (let i = 0; i < vars.length; i++) {
          let start = vars[i].moveNr - 1;
          let parent = vars[i].parent;
          let line = [];
          while (parent !== -1) {
            line = [
              ...vars[parent].moves.slice(
                0,
                vars[i].moveNr - vars[parent].moveNr
              ),
              ...line,
            ];
            start = vars[parent].moveNr - 1;
            parent = vars[parent].parent;
          }

          line = [...moves.slice(0, start), ...line];

          variations.push({
            moveNr: vars[i].moveNr,
            parent: vars[i].parent == -1 ? null : vars[i].parent,
            moves: [],
          });

          for (let x = 0; x < line.length; x++) {
            game.move(line[x]);
          }

          for (let x = 0; x < vars[i].moves.length; x++) {
            game.move(vars[i].moves[x]);

            variations[variations.length - 1].moves.push(
              game.history({ verbose: true }).pop()
            );
          }

          game.reset();
          if (fen != "") {
            game.load(fen);
          }
        }
      } catch (err) {
        console.log(err);

        valid = false;
      }

      if (valid) {
        // turn on pgn mode
        this.pgnLoaded = true;

        // show the close pgn button
        this.elements.closePgnButton.classList.remove("is-hidden");

        // show the start position (if any)
        if (fen != "") {
          this.elements.pgnStartPositionContainer.classList.remove("is-hidden");
          this.elements.pgnStartPositionContainer.children[1].innerHTML = fen;
        }

        // start a new game with the initial FEN
        this.newGame(fen);

        this.history = history;
        this.variations = variations;
        this.settings.useVariations = true;

        // update the pgn field
        this.updatePgnField();

        // goto the last move
        this.gotoLast();

        return true;
      }
    }

    return false;
  }

  // Show the remove repertoire modal
  onRemoveRepertoireClick(event) {
    // open the dialog
    this.showConfirmModal();
  }

  // Remove the repertoire
  onRemoveLineConfirmed(event) {
    // close the modal
    this.closeConfirmModal();

    const url = "/api/repertoire";

    // Get the current move
    const last = this.game.history({ verbose: true }).pop();

    const data = {
      color: this.color,
      fen: this.getFen(),
      move: last.san,
    };

    fetch(url, {
      method: "DELETE",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

        // remove the repertoireId
        this.repertoireId = 0;
        this.repertoireAutoPlay = false;
        this.repertoireExclude = false;
        // reset the cache
        this.resetCache();
        // toggle the buttons
        this.toggleButtons(false);
        // remove the dots for any child moves that have been deleted
        this.movesRemoveDots();
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // Fetch the repertoire groups
  getGroups() {
    const url = "/api/repertoire/groups";

    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        // store the groups
        this.groups = response.groups;
        this.groupsWithEco = response.groups;
        // load the groups table
        this.loadGroups();
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // Load the groups
  loadGroups(ecoCode = "") {
    // clear the groups
    while (this.elements.repertoireGroupDataList.firstChild) {
      this.elements.repertoireGroupDataList.removeChild(
        this.elements.repertoireGroupDataList.lastChild
      );
    }

    // Check to see if we already have the current ECO as a group
    this.groupsWithEco = this.groups.slice(0);
    let add = true;
    // TODO: change this to findIndex ?
    for (let i = 0; i < this.groupsWithEco.length; i++) {
      if (this.groupsWithEco[i].name == ecoCode) {
        add = false;
      }
    }

    // Add the current ECO as a group, if needed
    if (add) {
      this.groupsWithEco.push({ id: 0, name: ecoCode });
    }

    // Load the groups in the datalist
    for (let i = 0; i < this.groupsWithEco.length; i++) {
      const opt = document.createElement("option");
      opt.value = this.groupsWithEco[i].name;
      opt.setAttribute("data-id", this.groupsWithEco[i].id);

      this.elements.repertoireGroupDataList.appendChild(opt);
    }
  }

  // Reset the get api/moves cache
  resetCache(current = false) {
    if (current) {
      for (let i = 0; i < this.cache.length; i++) {
        if (this.cache[i].pgn == this.game.pgn()) {
          this.cache.splice(i, 1);
          break;
        }
      }
    } else {
      this.cache = [];
    }
  }

  // Get the moves for the current position, from cache or the API
  getMoves() {
    // clear the moves table
    this.clearMovesTable();

    // Toggle the engine container (if no game moves)
    if (this.game.moveNumber() > 1) {
      this.toggleEngineContainer(true);
    } else {
      this.toggleEngineContainer(false);
    }

    // find the data in our cache
    for (let i = 0; i < this.cache.length; i++) {
      if (this.cache[i].pgn == this.game.pgn()) {
        console.info("found", i, this.game.pgn());
        // handle the response
        this.onGetMoves(this.cache[i].data, true);

        return true;
      }
    }

    // get the moves from the api
    this.getMovesFromApi();
  }

  // Fetch moves for current position
  getMovesFromApi() {
    // show the page loader
    Utils.showLoading();

    const url = "/api/repertoire/moves";

    const data = {
      color: this.color,
      fen: this.getFen(),
      fen2: this.game.fen(),
      pgn: this.game.pgn(),
      turn: this.game.turn(),
      moveNumber: this.game.moveNumber(),
    };

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        // handle the response
        this.onGetMoves(response);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  // Show the moves, the repertoire details, and load the groups
  onGetMoves(data, fromCache = false) {
    // Cache the data if needed
    if (!fromCache) {
      this.cache.push({ pgn: this.game.pgn(), data: data });
    }

    console.log('onGetMoves:', data);

    // Remember the current repertoire details
    this.repertoireId = data["current"]["id"];
    this.repertoireAutoPlay = data["current"]["autoplay"];
    this.repertoireExclude = data["current"]["exclude"];
    this.repertoireIncluded = data["current"]["included"];

    // Toggle the buttons
    this.toggleButtons(this.repertoireId > 0);

    // If we haven't loaded the initial fens yet
    if (!this.initialFensLoaded) {
      // If we have initial fens
      if (data["initialFens"] && data["initialFens"].length > 0) {
        this.showInitialFens();
        this.loadInitialFens(data["initialFens"]);
      } else {
        this.hideInitialFens();
      }

      this.initialFensLoaded = true;
    }

    // Set the current ECO code
    this.elements.ecoField.innerHTML =
      data.eco.current && data.eco.current.name ? data.eco.current.name : "";

    // Load the moves table
    this.loadMovesTable(data);

    // Set the autoplay & exclude checkboxes
    this.elements.repertoireAutoPlayCheckbox.checked = this.repertoireAutoPlay;
    this.elements.repertoireExcludeCheckbox.checked = this.repertoireExclude;
    this.elements.repertoireExcludeCheckbox.disabled = this.repertoireIncluded == false;

    // Store the groups for this move
    this.repertoireGroups = data.groups;

    // Reload the groups
    this.loadGroups(this.elements.ecoField.innerHTML);

    // Clear the group tags
    this.clearGroupTags();

    // If this repertoire is saved
    if (this.repertoireId > 0) {
      // add the group tags
      this.addGroupTags();
    }

    // Toggle the analyse on lichess button
    this.elements.analyseGameButton.disabled = this.game.moveNumber() < 2;
  }

  // Open the current position in Lichess for analysis
  onAnalyseGame() {
    window.open(
      "https://lichess.org/analysis/standard/" + encodeURIComponent(this.getFen()),
      "_blank"
    );
  }

  /*
   * Engine functions
   */

  toggleEngineContainer(show) {

    console.log('toggleEngineContainer:', show);

    // turn off the engine by default
    this.elements.engineCheckbox.checked = false;

    if (show) {
      // clear the table
      this.engineTableReset();
      // show the container & the start engine text
      this.elements.engineContainer.classList.remove("is-hidden");
      this.elements.engineTable.parentNode.firstElementChild.classList.remove("is-hidden");
      // clear the depth
      this.elements.engineDepth.innerHTML = "";
      // disable the toggle if the game has ended
      this.elements.engineCheckbox.disabled = this.game.isGameOver();
    } else {
      // hide the container
      this.elements.engineContainer.classList.add("is-hidden");

      // make sure the engine is stopped
      this.onEngineToggle();
    }
  }

  engineTableReset() {
    // clear the table
    while (this.elements.engineTable.firstChild) {
      this.elements.engineTable.removeChild(this.elements.engineTable.lastChild);
    }
  }

  onEngineToggle() {
    console.info("onEngineToggle:", this.elements.engineCheckbox.checked);

    if (this.elements.engineCheckbox.checked) {
      // Remember the FEN we are calculating for
      this.engineFen = this.currentFen;

      // Start the search (will interrupt or start engine when needed)
      this.engineHelper.startSearch({ 
        moves: this.getUciMoves()
      });

      // hide the start engine text
      this.elements.engineTable.parentNode.firstElementChild.classList.add("is-hidden");
    } else {
      // Stop the engine
      this.engineHelper.stopEngine();
    }
  }

  // Get the current UCI moves for the engine
  getUciMoves() {
    console.info("Repertoire.js - getUciMoves");

    let uciMoves = "";

    const history = this.game.historyWithCorrectFen();

    for (let i = 0; i < history.length; i++) {
      uciMoves = uciMoves + (uciMoves !== "" ? " " : "") + history[i].from + history[i].to;
    }

    return uciMoves;
  }

  onEngineInfo(info) {
    // if for an old position
    if (this.currentFen !== this.engineFen) {
      return false;
    }

    // get the san moves
    const moves = [];
    let line = "";

    //console.info(info);

    // make sure we have a line
    if (info.pv && info.pv.length) {
      try {
        // show the depth
        if (info.depth) {
          this.elements.engineDepth.innerHTML = "Depth " + info.depth;
        }

        // create a game
        const game = new MyChess();
        game.load(this.currentFen);

        // go through the moves
        for (let i = 0; i < info.pv.length; i++) {
          game.move({
            from: info.pv[i].substring(0, 2),
            to: info.pv[i].substring(2, 4),
            promotion: info.pv[i].length == 5 ? info.pv[i].substring(4, 5) : "",
          });

          const last = game.history({ verbose: true }).pop();

          moves.push(last);

          line = line + (line !== "" ? " " + last.san : "<strong>" + last.san + "</strong>");
        }
      } catch (err) {
        console.error("Error:", err, info);
      }
    }

    const multipv = parseInt(info["multipv"]);
    let row;

    // if we already have this row
    if (this.elements.engineTable.rows.length > multipv - 1) {
      // get the row
      row = this.elements.engineTable.rows[multipv - 1];
    } else {
      // add the row
      row = this.elements.engineTable.insertRow(-1);
      row.className = "cursor-pointer";

      let cell = row.insertCell(-1);
      cell.className = "p-2 is-nowrap";

      cell = row.insertCell(-1);
      cell.className = "w-full p-2";

      // add event listeners
      row.addEventListener("mouseover", (event) => {
        // make sure we have the row as target
        let targ = event.target;
        while (targ.parentNode && targ.tagName.toLowerCase() != "tr") {
          targ = targ.parentNode;
        }

        this.showPreviewMove(targ.dataset.move);
      });

      row.addEventListener("mouseleave", (event) => {
        this.undoPreviewMove();
      });

      row.addEventListener("click", (event) => {
        // make sure we have the row as target
        let targ = event.target;
        while (targ.parentNode && targ.tagName.toLowerCase() != "tr") {
          targ = targ.parentNode;
        }

        // only make the move if the table is not disabled (if it is, the moves are being loaded)
        if (!targ.parentNode.parentNode.disabled) {
          // get the move
          const move = targ.dataset.move;
          // turn the engine off
          this.elements.engineCheckbox.checked = false;
          this.onEngineToggle();
          // goto this move
          this.clickMove(move);
        }
      });
    }

    // we need to invert if it's blacks turn (centipawn is always from the engine's pov)
    const invert = this.currentTurn == "b";

    // invert the centipawn and mate values
    const cp =
      info.score.cp !== null && invert ? info.score.cp * -1 : info.score.cp;
    const mate =
      info.score.mate !== null && invert
        ? info.score.mate * -1
        : info.score.mate;
    // get the score
    const score =
      cp !== null
        ? (cp > 0 ? "+" : "") + cp / 100
        : mate !== null
          ? "M" + mate
          : "";

    // update the pv
    row.setAttribute("data-move", moves.length > 0 ? moves[0].san : "");
    row.cells[0].innerHTML = score;
    row.cells[1].innerHTML = line;
  }

  /**
   * Group (tags) functions.
   */

  // Remove the group tags
  clearGroupTags() {
    while (this.elements.repertoireGroupTagsContainer.firstChild) {
      this.elements.repertoireGroupTagsContainer.removeChild(
        this.elements.repertoireGroupTagsContainer.lastChild
      );
    }
  }

  // Add the group tags
  addGroupTags() {
    for (let i = 0; i < this.repertoireGroups.length; i++) {
      this.addGroupTag(this.repertoireGroups[i]);
    }
  }

  // Add a group tag
  addGroupTag(group, save = false) {
    // see if the group is already added
    for (
      let i = 0;
      i < this.elements.repertoireGroupTagsContainer.children.length;
      i++
    ) {
      if (
        this.elements.repertoireGroupTagsContainer.children[i].children[0].innerHTML ==
        group.name
      ) {
        return false;
      }
    }

    //
    const el = document.createElement("span");
    el.className =
      "is-flex is-align-items-center mr-1 rounded py-1 px-2";
    el.setAttribute("data-id", group.id);
    el.setAttribute("data-type", "tag");

    const txt = document.createElement("span");
    txt.className = "is-size-7 mr-2 font-semibold text-secondary-800";
    txt.innerHTML = group.name;

    el.appendChild(txt);

    const btn = document.createElement("button");
    btn.className =
      "button is-small";
    btn.innerHTML = '<span class="icon"><i class="fa-solid fa-trash"></i></span>';
    btn.addEventListener("click", this.onRepertoireGroupRemove.bind(this));

    el.appendChild(btn);

    this.elements.repertoireGroupTagsContainer.appendChild(el);

    // if we need to save it
    if (save) {
      // save the repertoire group
      this.saveRepertoireGroup(group);
      // add to the groups array
      let add = true;
      for (let i = 0; i < this.groups.length; i++) {
        if (this.groups[i].name == group.name) {
          add = false;
          break;
        }
      }
      if (add) {
        this.groups.push({ id: 0, name: group.name });
      }
    }
  }

  // onChange event for repertoire autoplay checkbox
  onRepertoireAutoPlayChange(event) {
    // set the data object
    const data = {
      repertoire: this.repertoireId,
      autoplay: this.elements.repertoireAutoPlayCheckbox.checked,
    };

    // send the API request
    const url = "/api/repertoire/autoplay";
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));

        // reset the cache
        this.resetCache(true);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // onChange event for repertoire exclude checkbox
  onRepertoireExcludeChange(event) {
    // set the data object
    const data = {
      repertoire: this.repertoireId,
      exclude: this.elements.repertoireExcludeCheckbox.checked,
    };

    // send the API request
    const url = "/api/repertoire/exclude";
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));

        // reset the cache
        this.resetCache(true);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // onInput event for the repertoire group input
  onRepertoireGroupInput(event) {
    // if value matches 1 of the groups, presume it was clicked on and add it
    if (this.elements.repertoireGroupInput.value != "") {
      for (let i = 0; i < this.groupsWithEco.length; i++) {
        if (this.elements.repertoireGroupInput.value == this.groupsWithEco[i].name) {
          // add the group
          this.addGroupTag(this.groupsWithEco[i], true);

          this.elements.repertoireGroupInput.value = "";
          break;
        }
      }
    }
  }

  // onKeyDown event for the repertoire group input
  onRepertoireGroupKeyDown(event) {
    // if Enter was pressed and we have a value
    if (event.key === "Enter" && event.target.value.trim() !== "") {
      // check to see if this is an existing group or not
      for (let i = 0; i < this.groupsWithEco.length; i++) {
        if (this.elements.repertoireGroupInput.value == this.groupsWithEco[i].name) {
          // add the group
          this.addGroupTag(this.groupsWithEco[i], true);

          this.elements.repertoireGroupInput.value = "";

          return;
        }
      }

      // add the (new) group tag
      this.addGroupTag({ id: 0, name: this.elements.repertoireGroupInput.value }, true);

      this.elements.repertoireGroupInput.value = "";
    }
  }

  // event when the remove tag button is clicked
  onRepertoireGroupRemove(event) {
    // find the tag
    let tag = event.target.parentNode;
    while (tag.parentNode) {
      if (tag.getAttribute("data-type") === "tag") {
        // get the group name
        const groupName = tag.children[0].innerHTML;
        // remove the tag
        tag.parentNode.removeChild(tag);

        // remove the repertoire group
        this.removeRepertoireGroup(groupName);

        return true;
      }

      tag = tag.parentNode;
    }

    return false;
  }

  // save the repertoire group
  saveRepertoireGroup(group) {
    // set the data object
    const data = {
      repertoire: this.repertoireId,
      group: group.name,
    };

    // send the API request
    const url = "/api/repertoire/group";
    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));

        // reset the cache
        this.resetCache(true);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // remove the repertoire group
  removeRepertoireGroup(groupName) {
    // set the data object
    const data = {
      repertoire: this.repertoireId,
      group: groupName,
    };

    // send the API request
    const url = "/api/repertoire/group";
    fetch(url, {
      method: "DELETE",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));

        // reset the cache
        this.resetCache(true);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // toggle the buttons
  toggleButtons(saved) {
    // make sure we've made a move
    const hasMoved =
      (this.color == "white" &&
        (this.game.moveNumber() > 1 || this.game.turn() == "b")) ||
      (this.color == "black" && this.game.moveNumber() > 1);

    // toggle the save repertoire button
    this.toggleSaveRepertoire(!saved && hasMoved);

    const ourTurn =
      (this.color == "white" && this.game.turn() == "w") ||
      (this.color == "black" && this.game.turn() == "b");

    if (saved && !ourTurn) {
      this.showRepertoireDetails();
    } else {
      this.hideRepertoireDetails();
    }
  }

  // toggle the save repertoire button
  toggleSaveRepertoire(enabled) {
    this.elements.saveRepertoireButton.disabled = !enabled;
  }

  // save the current path to your repertoire (color, starting position, move, end position)
  onSaveRepertoire() {
    let pgn = "";
    const moves = this.game.historyWithCorrectFen();
    for (let i = 0; i < moves.length; i++) {
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];
      moves[i]["pgn"] = pgn;
      pgn += " ";
    }

    // set the data object
    const data = {
      color: this.color,
      initialFen: this.initialFen,
      moves: moves,
    };

    // send the API request
    const url = "/api/repertoire";
    fetch(url, {
      method: "POST", // or 'PUT'
      body: JSON.stringify(data), // data can be `string` or {object}!
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:", JSON.stringify(response));

        // reset the cache
        this.resetCache();
        // toggle the buttons
        this.toggleButtons(true);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // show the repertoire details
  showRepertoireDetails() {
    this.elements.repertoireContainer.classList.remove("is-hidden");
  }

  // hide the repertoire details
  hideRepertoireDetails() {
    this.elements.repertoireContainer.classList.add("is-hidden");
  }

  /**
   * Moves table functions.
   */

  // clear the moves table
  clearMovesTable() {
    this.elements.movesTable.disabled = true;
    this.elements.movesTable.classList.add("opacity-50");
  }

  // load the moves table
  loadMovesTable(data) {
    // hide the skeleton loader
    this.elements.movesTable.previousElementSibling.classList.add("is-hidden");
    // remove all current moves
    while (this.elements.movesTable.tBodies[0].rows.length > 0) {
      this.elements.movesTable.tBodies[0].deleteRow(0);
    }

    this.elements.movesTable.disabled = false;
    this.elements.movesTable.classList.remove("opacity-50");

    // add the repertoire moves
    for (let i = 0; i < data.repertoire.length; i++) {
      const params = {
        move: data.repertoire[i].move,
        cp: data.repertoire[i].cp,
        mate: data.repertoire[i].mate,
        eco: data.repertoire[i].eco,
        name: data.repertoire[i].name,
        repertoire: 1,
        percentage: data.repertoire[i].percentage,
        total: data.repertoire[i].total,
        wins: data.repertoire[i].wins,
        draws: data.repertoire[i].draws,
        losses: data.repertoire[i].losses,
      };

      this.movesAddRow(params);
    }

    // add the most played moves
    for (let i = 0; i < data.games.moves.length; i++) {
      // if not in our repertoire
      if (data.games.moves[i].repertoire == 0) {
        this.movesAddRow(data.games.moves[i]);
      }
    }

    // toggle no moves found text
    if (this.elements.movesTable.tBodies[0].rows.length > 0) {
      this.elements.movesTable.parentNode.firstElementChild.classList.add("is-hidden");
    } else {
      this.elements.movesTable.parentNode.firstElementChild.classList.remove("is-hidden");
    }
  }

  // add a row to the moves table
  movesAddRow(data) {
    const row = this.elements.movesTable.tBodies[0].insertRow(-1);
    row.className =
      "moves-row";
    row.setAttribute("data-move", data.move);

    let cell = row.insertCell(-1);
    cell.className =
      "move-cell";
    cell.innerHTML = data.move;

    cell = row.insertCell(-1);
    cell.className = "eco-cell";
    cell.innerHTML = data.name;

    cell = row.insertCell(-1);
    cell.className = "eval-cell";

    // set the CP eval
    cell.innerHTML =
      data.mate !== null
        ? "M" + data.mate
        : data.cp !== null
          ? (data.cp >= 0 ? "+" : "") + Math.round(data.cp) / 100
          : "";

    // show percentage played
    cell = row.insertCell(-1);
    cell.className = "pct-played-cell";
    cell.innerHTML = data.percentage > 0 ? data.percentage + "%" : "";

    // show win/draw/lose %
    cell = row.insertCell(-1);
    cell.className = "results-cell";
    if (data.total > 0) {
      // get the percentages
      const wpct = Math.round((data.wins / data.total) * 100);
      const lpct = Math.round((data.losses / data.total) * 100);
      const dpct = Math.max(0, 100 - wpct - lpct);

      const flex = document.createElement("div");
      flex.className = "win-draw-loss-bar";
      flex.title = this.getNumberOfGames(data.total);

      const div1 = document.createElement("div");
      div1.className = "win-bar";
      div1.innerHTML = wpct + "%";
      div1.style = "width: " + wpct + "%;";

      const div2 = document.createElement("div");
      div2.className = "draw-bar";
      //div2.innerHTML = dpct + "%";
      div2.style = "width: " + dpct + "%;";

      const div3 = document.createElement("div");
      div3.className = "loss-bar";
      div3.innerHTML = lpct + "%";
      div3.style = "width: " + lpct + "%;";

      flex.appendChild(div1);
      flex.appendChild(div2);
      flex.appendChild(div3);

      cell.appendChild(flex);
    }

    // show a dot if in repertoire
    cell = row.insertCell(-1);
    cell.className = "in-repertoire-cell";
    if (data.repertoire) {
      cell.innerHTML =
        '<div class="in-repertoire-dot"></div>';
    }

    // add event listeners
    row.addEventListener("mouseover", (event) => {
      // make sure we have the row as target
      let targ = event.target;
      while (targ.parentNode && targ.tagName.toLowerCase() != "tr") {
        targ = targ.parentNode;
      }

      this.showPreviewMove(targ.dataset.move);
    });

    row.addEventListener("mouseleave", (event) => {
      this.undoPreviewMove();
    });

    row.addEventListener("click", (event) => {
      // make sure we have the row as target
      let targ = event.target;
      while (targ.parentNode && targ.tagName.toLowerCase() != "tr") {
        targ = targ.parentNode;
      }

      // only make the move if the table is not disabled (if it is, the moves are being loaded)
      if (!targ.parentNode.parentNode.disabled) {
        this.clickMove(targ.dataset.move);
      }
    });
  }

  // clear the dots (if a move was deleted from the repertoire)
  movesRemoveDots() {
    for (let i = 0; i < this.elements.movesTable.tBodies[0].rows.length; i++) {
      this.elements.movesTable.tBodies[0].rows[i].cells[5].innerHTML = "";
    }
  }

  // show the preview move
  showPreviewMove(move) {
    if (move != this.previewMove) {
      // undo the current preview move
      if (this.previewMove != "") {
        this.previewMove = "";
        this.game.undo();
        // remove the markers
        this.board.removeMarkers();
      }

      try {
        // make the move
        this.game.move(move);

        // highlight the move
        const last = this.game.history({ verbose: true }).pop();

        this.board.addMarker(MARKER_TYPE.square, last.from);
        this.board.addMarker(MARKER_TYPE.square, last.to);

        // remember the current preview move
        this.previewMove = move;

        // update the board
        this.board.setPosition(this.game.fen());

        return true;
      } catch (err) {
        return false;
      }
    }
  }

  // get the number of games as formatted text
  getNumberOfGames(total) {
    return Utils.getAbbreviatedNumber(total) + " games";
  }

  // undo the preview move
  undoPreviewMove() {
    if (this.previewMove != "") {
      this.previewMove = "";

      // undo the preview move
      this.game.undo();
      this.board.setPosition(this.game.fen());
      // remove the markers
      this.board.removeMarkers();
    }
  }

  // make a move from the moves list
  clickMove(move) {
    // if there was a preview move, undo it
    if (this.previewMove != "") {
      this.game.undo();
    }

    // clear the preview move
    this.previewMove = "";

    // make the move
    this.makeMove(move);
  }

  /**
   * Initial fens functions.
   */

  showInitialFens() {
    this.elements.initialFenContainer.classList.remove("is-hidden");
  }

  hideInitialFens() {
    this.elements.initialFenContainer.classList.add("is-hidden");
  }

  loadInitialFens(data) {
    while (this.elements.initialFenSelect.firstChild) {
      this.elements.initialFenSelect.removeChild(this.elements.initialFenSelect.lastChild);
    }

    let opt = document.createElement("option");
    opt.value = "";
    opt.text = "default";

    this.elements.initialFenSelect.appendChild(opt);

    for (let i = 0; i < data.length; i++) {
      opt = document.createElement("option");
      opt.value = data[i];
      opt.text = data[i];
      opt.selected = data[i] == this.initialFen;

      this.elements.initialFenSelect.appendChild(opt);
    }
  }

  onSelectInitialFen(event) {
    // set the initial fen
    this.initialFen = this.elements.initialFenSelect.value;

    // reset the board
    if (this.initialFen != "") {
      this.game.load(this.initialFen);
    } else {
      this.game.reset();
    }

    // update the board
    this.board.setPosition(this.game.fen(), true);

    // reset the history & variations
    this.resetToCurrent(this.initialFen);

    // update the status & get the moves
    this.updateStatus();
  }

  // event handlers
  afterMove(move) {

    console.log('Repertoire.js - afterMove', move);

    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  }

  afterGotoMove(moveNr, variationIdx) {

    console.log('Chessboard.js - afterGotoMove:', moveNr, variationIdx);

    // reset the history to the current position
    if (!this.pgnLoaded) {
      //this.resetToCurrent(this.initialFen);
    }
    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  }
  /**
   * Called after a move was move. Update the status fields and fetch the moves.
   *
   * @memberof Repertoire
   */
  updateStatus() {
    let status = "";

    let moveColor = "White";
    if (this.game.turn() === "b") {
      moveColor = "Black";
    }

    // Update the game status
    if (this.game.isCheckmate()) {
      status = "Game over, " + moveColor + " is in checkmate.";
    } else if (this.game.isDraw()) {
      status = "Game over, drawn position";
    } else {
      status = moveColor + " to move";
      if (this.game.isCheck()) {
        status += ", " + moveColor + " is in check";
      }
    }

    this.elements.statusField.innerHTML = status;

    // Remember the current FEN (without any preview moves, etc)
    this.currentFen = this.getFen();
    this.currentTurn = this.game.turn();

    // Update the pgn field
    this.updatePgnField();

    // Toggle the goto first move button
    this.elements.gotoFirstButton.disabled = this.isFirst();

    // Get the moves for the new position
    this.getMoves();
  }
}

// Initialise the Repertoire object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  const repertoire = new Repertoire();
});
