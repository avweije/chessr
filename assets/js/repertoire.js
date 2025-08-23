import { MyChess } from "chess";
import { BOARD_STATUS, MyChessBoard, PIECE_TILESIZE } from "chessboard";
import {
  MARKER_TYPE,
  Markers,
} from "../cm-chessboard/src/extensions/markers/Markers.js";
import { COLOR } from "../cm-chessboard/src/view/ChessboardView.js";
import { Utils } from "utils";
import { Modal } from "modal";
import { UCI } from "uci";

import "../styles/chessboard.css";

class Repertoire extends MyChessBoard {
  whiteRepertoireRadio = null;
  blackRepertoireRadio = null;

  currentFen = "";
  currentTurn = "";
  engineFen = "";
  previewMove = "";

  statusField = null;
  ecoField = null;
  pgnField = null;
  pgnStartPositionContainer = null;

  color = "white";
  gotoFirstButton = null;
  loadPgnButton = null;
  closePgnButton = null;
  saveRepertoireButton = null;
  movesTable = null;

  analyseGameButton = null;

  pgnLoaded = false;

  engineContainer = null;
  engineDepth = null;
  engineCheckbox = null;
  engineTable = null;

  uci = null;

  repertoireContainer = null;
  repertoireAutoPlayCheckbox = null;
  repertoireExcludeCheckbox = null;
  repertoireGroupInput = null;
  repertoireGroupDataList = null;
  repertoireGroupTagsContainer = null;
  removeRepertoireButton = null;

  repertoire = {
    id: 0,
    container: null,
    groupInput: null,
    groupDataList: null,
    groupTagsContainer: null,
    removeButton: null,
  };

  cache = [];

  repertoireId = 0;
  repertoireAutoPlay = false;
  repertoireExclude = false;
  repertoireIncluded = true;
  groups = [];
  repertoireGroups = [];

  initialFensLoaded = false;
  initialFenContainer = null;
  initialFenSelect = null;

  confirmDialog = {};
  loadPgnDialog = {};

  settings = null;

  constructor() {
    super();

    // show the page loader
    Utils.showLoading();

    // get the repertoire color radio buttons
    this.whiteRepertoireRadio = document.getElementById("whiteRepertoireRadio");
    this.blackRepertoireRadio = document.getElementById("blackRepertoireRadio");

    // add event listeners
    this.whiteRepertoireRadio.addEventListener(
      "click",
      this.onRepertoireColorSwitch.bind(this)
    );
    this.blackRepertoireRadio.addEventListener(
      "click",
      this.onRepertoireColorSwitch.bind(this)
    );

    // get the status fields
    this.statusField = document.getElementById("statusField");
    this.ecoField = document.getElementById("ecoField");

    // set the pgn field
    this.setPgnField(document.getElementById("pgnField"));

    this.pgnStartPositionContainer = document.getElementById(
      "pgnStartPositionContainer"
    );

    // get the buttons
    this.gotoFirstButton = document.getElementById("gotoFirstButton");
    this.loadPgnButton = document.getElementById("loadPgnButton");
    this.closePgnButton = document.getElementById("closePgnButton");
    this.saveRepertoireButton = document.getElementById("saveRepertoireButton");

    this.analyseGameButton = document.getElementById("analyseGameButton");

    // get the moves table
    this.movesTable = document.getElementById("movesTable");

    // get the engine container & table
    this.engineContainer = document.getElementById("engineContainer");
    this.engineDepth = document.getElementById("engineDepth");
    this.engineCheckbox = document.getElementById("engineCheckbox");
    this.engineTable = document.getElementById("engineTable");

    this.engineCheckbox.addEventListener(
      "click",
      this.onEngineToggle.bind(this)
    );

    // get the repertoire container and elements
    this.repertoireContainer = document.getElementById("repertoireContainer");
    this.repertoireAutoPlayCheckbox = document.getElementById(
      "repertoireAutoPlayCheckbox"
    );
    this.repertoireExcludeCheckbox = document.getElementById(
      "repertoireExcludeCheckbox"
    );
    this.repertoireGroupInput = document.getElementById("repertoireGroupInput");
    this.repertoireGroupDataList = document.getElementById(
      "repertoireGroupDataList"
    );
    this.repertoireGroupTagsContainer = document.getElementById(
      "repertoireGroupTagsContainer"
    );
    this.removeRepertoireButton = document.getElementById(
      "removeRepertoireButton"
    );

    // get the initial fens elements
    this.initialFenContainer = document.getElementById("initialFenContainer");
    this.initialFenSelect = document.getElementById("initialFenSelect");

    this.initialFenSelect.addEventListener(
      "change",
      this.onSelectInitialFen.bind(this)
    );

    // attach the event handlers
    this.gotoFirstButton.addEventListener("click", this.onGotoFirst.bind(this));
    this.loadPgnButton.addEventListener("click", this.onLoadPgn.bind(this));
    this.closePgnButton.addEventListener("click", this.onClosePgn.bind(this));

    this.saveRepertoireButton.addEventListener(
      "click",
      this.onSaveRepertoire.bind(this)
    );

    this.analyseGameButton.addEventListener(
      "click",
      this.onAnalyseGame.bind(this)
    );

    this.repertoireAutoPlayCheckbox.addEventListener(
      "change",
      this.onRepertoireAutoPlayChange.bind(this)
    );

    this.repertoireExcludeCheckbox.addEventListener(
      "change",
      this.onRepertoireExcludeChange.bind(this)
    );

    this.repertoireGroupInput.addEventListener(
      "input",
      this.onRepertoireGroupInput.bind(this)
    );
    this.repertoireGroupInput.addEventListener(
      "keydown",
      this.onRepertoireGroupKeyDown.bind(this)
    );

    this.removeRepertoireButton.addEventListener(
      "click",
      this.onRemoveRepertoireClick.bind(this)
    );

    // get the settings (and then create the board)
    this.getSettings();

    // get the groups
    this.getGroups();

    // enable the load pgn button
    this.loadPgnButton.disabled = false;

    // get the modal elements
    this.confirmDialog.modal = document.getElementById("confirmModal");
    this.confirmDialog.closeButton = document.getElementById(
      "confirmModalCloseButton"
    );
    this.confirmDialog.cancelButton = document.getElementById(
      "confirmModalCancelButton"
    );
    this.confirmDialog.confirmButton = document.getElementById(
      "confirmModalConfirmButton"
    );

    // register the modal
    Modal.register(this.confirmDialog.modal, [
      {
        element: this.confirmDialog.closeButton,
        action: "close",
      },
      {
        element: this.confirmDialog.cancelButton,
        action: "close",
      },
      {
        element: this.confirmDialog.confirmButton,
        action: "handler",
        handler: this.onRemoveLineConfirmed.bind(this),
      },
    ]);

    // get the modal elements
    this.loadPgnDialog.modal = document.getElementById("loadPgnModal");
    this.loadPgnDialog.closeButton = document.getElementById(
      "loadPgnModalCloseButton"
    );
    this.loadPgnDialog.cancelButton = document.getElementById(
      "loadPgnModalCancelButton"
    );
    this.loadPgnDialog.confirmButton = document.getElementById(
      "loadPgnModalConfirmButton"
    );
    this.loadPgnDialog.loadPgnModalPgnTextArea = document.getElementById(
      "loadPgnModalPgnTextArea"
    );

    // register the modal
    Modal.register(this.loadPgnDialog.modal, [
      {
        element: this.loadPgnDialog.closeButton,
        action: "close",
      },
      {
        element: this.loadPgnDialog.cancelButton,
        action: "close",
      },
      {
        element: this.loadPgnDialog.confirmButton,
        action: "handler",
        handler: this.onLoadPgnConfirmed.bind(this),
      },
    ]);

    // hide the page loader
    Utils.hideLoading();
  }

  // get the settings
  getSettings() {
    // show the page loader
    Utils.showLoading();

    var url = "/api/settings";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

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

  onGetSettings(settings) {
    // store the settings
    this.settings = settings;
    // get the board element
    var el = document.getElementById("board");
    // get the repertoire color
    this.color = el.getAttribute("data-color");

    // get the repertoire initial fen & line (in case we need to jump to a certain position through a POST)
    var fen = el.getAttribute("data-fen");
    var line = el.getAttribute("data-line");

    line = line && line != "" ? line.split(",") : [];

    console.log("onGetSettings:");
    console.log(fen, line);

    // the board settings
    var boardSettings = {
      orientation: this.color == "white" ? COLOR.white : COLOR.black,
      style: {
        pieces: {},
      },
    };
    if (settings.board) {
      boardSettings.style.cssClass = settings.board;
    }
    if (settings.pieces) {
      boardSettings.style.pieces.file = "pieces/" + settings.pieces;
      boardSettings.style.pieces.tileSize = PIECE_TILESIZE.get(settings.pieces);
    }
    if (settings.animation) {
      boardSettings.style.animationDuration = settings.animation;
    }

    // create the chess board
    this.init(el, boardSettings, {
      useVariations: false,
      navigationEnabled: true,
    });

    // if we have a position we need to jump to
    if (line.length > 0) {
      // make the moves
      try {
        for (var i = 0; i < line.length; i++) {
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

  onRepertoireColorSwitch() {
    // get the color
    var color = this.whiteRepertoireRadio.checked ? "white" : "black";

    // if switched
    if (color != this.color) {
      // reset the board
      this.game.reset();
      this.board.setPosition(this.game.fen());
      // remove the markers
      this.board.removeMarkers();
      // set the orientation
      var orient = color == "black" ? COLOR.black : COLOR.white;
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

  // called when the button is clicked
  onGotoFirst(event) {
    // goto the 1st move
    this.gotoFirst();
  }

  onLoadPgn(event) {
    console.log("onLoadPgn:");

    console.log(this.loadPgnDialog.loadPgnModalPgnTextArea.value);

    // clear the textarea
    this.loadPgnDialog.loadPgnModalPgnTextArea.value = "";

    // show the modal
    Modal.open(this.loadPgnDialog.modal);
  }

  onLoadPgnConfirmed() {
    console.log("onLoadPgnConfirmed:");
    console.log(this.loadPgnDialog.loadPgnModalPgnTextArea.value);

    // close the modal
    Modal.close(this.loadPgnDialog.modal);

    // parse the PGN
    this.parsePgn(this.loadPgnDialog.loadPgnModalPgnTextArea.value);
  }

  onClosePgn(event) {
    console.log("onClosePgn:");

    // turn off variations, reset to current position
    this.settings.useVariations = false;
    this.resetToCurrent(this.initialFen);

    // hide elements
    this.pgnStartPositionContainer.classList.add("is-hidden");
    this.closePgnButton.classList.add("is-hidden");

    // turn off pgn mode
    this.pgnLoaded = false;
  }

  parsePgn(pgnText) {
    console.log("parsePgn:");

    //
    pgnText = pgnText.replace(new RegExp("\r?\n", "g"), "\n");
    pgnText = pgnText.replace(new RegExp("\\(", "g"), "( ");
    pgnText = pgnText.replace(new RegExp("\\)", "g"), " )");

    console.log(pgnText);

    //
    var fen = "";
    var lines = pgnText.split("\n");

    console.log(lines);

    var pgnMoves = "";
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].charAt(0) == "[") {
        //list($key, $val) = explode(' ', $line, 2);
        //$key = strtolower(trim($key, '['));
        //$val = trim($val, '"]');
        var parts = lines[i].substring(1, lines[i].length - 1).split(" ", 2);
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

    var parts = pgnMoves.split(" ");

    var moves = [];
    var vars = [];
    var currvar = -1;
    var movenr = 1;

    for (var i = 0; i < parts.length; i++) {
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

          var vmovenr =
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
          var moveNumberRegex = /\d+\.+/;
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
      var valid = true;

      var history = [];
      var variations = [];

      var game = new MyChess();

      // validate the moves
      try {
        // load the FEN (empty or initial setup)
        if (fen != "") {
          game.load(fen);
        }
        //
        for (var i = 0; i < moves.length; i++) {
          game.move(moves[i]);

          history.push(game.history({ verbose: true }).pop());
        }

        game.reset();
        if (fen != "") {
          game.load(fen);
        }

        for (var i = 0; i < vars.length; i++) {
          var start = vars[i].moveNr - 1;
          var parent = vars[i].parent;
          var line = [];
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

          for (var x = 0; x < line.length; x++) {
            game.move(line[x]);
          }

          for (var x = 0; x < vars[i].moves.length; x++) {
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
        this.closePgnButton.classList.remove("is-hidden");

        // show the start position (if any)
        if (fen != "") {
          this.pgnStartPositionContainer.classList.remove("is-hidden");
          this.pgnStartPositionContainer.children[1].innerHTML = fen;
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

  // fired once the remove repertoire button is clicked
  onRemoveRepertoireClick(event) {
    // open the dialog
    Modal.open(this.confirmDialog.modal);
  }

  // fired when the remove repertoire modal has been confirmed
  onRemoveLineConfirmed(event) {
    // close the modal
    Modal.close(this.confirmDialog.modal);

    var url = "/api/repertoire";

    var last = this.game.history({ verbose: true }).pop();

    var data = {
      color: this.color,
      fen: this.getFen(),
      move: last.san,
    };

    console.log(data);

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

  // fetch the repertoire groups
  getGroups() {
    var url = "/api/repertoire/groups";

    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log(response);

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

  // load the groups
  loadGroups(ecoCode = "") {
    // clear the groups
    while (this.repertoireGroupDataList.firstChild) {
      this.repertoireGroupDataList.removeChild(
        this.repertoireGroupDataList.lastChild
      );
    }

    //
    this.groupsWithEco = this.groups.slice(0);
    var add = true;
    for (var i = 0; i < this.groupsWithEco.length; i++) {
      if (this.groupsWithEco[i].name == ecoCode) {
        add = false;
      }
    }

    if (add) {
      this.groupsWithEco.push({ id: 0, name: ecoCode });
    }

    //
    for (var i = 0; i < this.groupsWithEco.length; i++) {
      var opt = document.createElement("option");
      opt.value = this.groupsWithEco[i].name;
      opt.setAttribute("data-id", this.groupsWithEco[i].id);

      this.repertoireGroupDataList.appendChild(opt);
    }
  }

  // reset the get api/moves cache
  resetCache(current = false) {
    if (current) {
      for (var i = 0; i < this.cache.length; i++) {
        if (this.cache[i].pgn == this.game.pgn()) {
          this.cache.splice(i, 1);
          break;
        }
      }
    } else {
      this.cache = [];
    }
  }

  getMoves() {
    // clear the moves table
    this.clearMovesTable();

    console.info("find in cache");

    // find the data in our cache
    for (var i = 0; i < this.cache.length; i++) {
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

  // fetch moves for current position
  getMovesFromApi() {
    // show the page loader
    Utils.showLoading();

    var url = "/api/repertoire/moves";

    var data = {
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
        console.log(response);

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

  // show the moves, the groups
  onGetMoves(data, fromCache = false) {
    // cache the data if needed
    if (!fromCache) {
      this.cache.push({ pgn: this.game.pgn(), data: data });
    }

    // remember the current repertoire details
    this.repertoireId = data["current"]["id"];
    this.repertoireAutoPlay = data["current"]["autoplay"];
    this.repertoireExclude = data["current"]["exclude"];
    this.repertoireIncluded = data["current"]["included"];

    // toggle the buttons
    this.toggleButtons(this.repertoireId > 0);

    // if we haven't loaded the initial fens yet
    if (!this.initialFensLoaded) {
      // if we have initial fens
      if (data["initialFens"] && data["initialFens"].length > 0) {
        this.showInitialFens();
        this.loadInitialFens(data["initialFens"]);
      } else {
        this.hideInitialFens();
      }

      this.initialFensLoaded = true;
    }

    // set the current ECO code
    this.ecoField.innerHTML =
      data.eco.current && data.eco.current.name ? data.eco.current.name : "";

    // load the moves table
    this.loadMovesTable(data);

    // toggle the engine container (if no game moves)
    if (data.games.moves.length > 0) {
      this.toggleEngineContainer(false);
    } else {
      this.toggleEngineContainer(true);
    }

    // set the autoplay & exclude checkboxes
    this.repertoireAutoPlayCheckbox.checked = this.repertoireAutoPlay;
    this.repertoireExcludeCheckbox.checked = this.repertoireExclude;
    this.repertoireExcludeCheckbox.disabled = this.repertoireIncluded == false;

    // store the groups for this move
    this.repertoireGroups = data.groups;

    // reload the groups
    this.loadGroups(this.ecoField.innerHTML);

    // clear the group tags
    this.clearGroupTags();

    // if this repertoire is saved
    if (this.repertoireId > 0) {
      // add the group tags
      this.addGroupTags();
    }

    // toggle the analyse on lichess button
    this.analyseGameButton.disabled = this.game.moveNumber() < 2;
  }

  onAnalyseGame() {
    window.open(
      "https://lichess.org/analysis?fen=" + encodeURIComponent(this.getFen()),
      "_blank"
    );
  }

  /*
   * Engine functions
   */

  toggleEngineContainer(show) {
    // turn off the engine by default
    this.engineCheckbox.checked = false;

    if (show) {
      // clear the table
      this.engineTableReset();
      // show the container & the start engine text
      this.engineContainer.classList.remove("is-hidden");
      this.engineTable.parentNode.firstElementChild.classList.remove("is-hidden");
      // clear the depth
      this.engineDepth.innerHTML = "";
      // disable the toggle if the game has ended
      this.engineCheckbox.disabled = this.game.isGameOver();
    } else {
      // hide the container
      this.engineContainer.classList.add("is-hidden");

      // make sure the engine is stopped
      this.onEngineToggle();
    }
  }

  engineTableReset() {
    // clear the table
    while (this.engineTable.firstChild) {
      this.engineTable.removeChild(this.engineTable.lastChild);
    }
  }

  onEngineToggle() {
    console.info("onEngineToggle:", this.engineCheckbox.checked);

    if (this.engineCheckbox.checked) {
      // start the engine
      this.engineStart();

      // hide the start engine text
      this.engineTable.parentNode.firstElementChild.classList.add("is-hidden");
    } else {
      // stop the engine
      this.engineStop();

      // show the start engine text
      //this.engineTable.parentNode.firstElementChild.classList.remove("is-hidden");
    }
  }

  engineStart() {
    console.info("Starting the engine.", this.uci);

    if (this.uci == null) {
      this.uci = new UCI();

      this.uci.onReceive("uciok", this.onEngineOK.bind(this));

      // start the engine
      this.uci.startEngine();
      this.uci.sendUCI();
    } else {
      // start the evaluation
      this.onEngineReady();
    }
  }

  engineStop() {
    console.info("Stopping the engine.");

    if (this.uci !== null) {
      this.uci.stopEngine();
      this.uci = null;
    }
  }

  engineInterrupt() {
    console.info("Interrupting the engine..");

    this.uci.interrupt();
    //this.uci.isReady();

    //this.uci.onReceive("readyok", stockfish.stopEngine.bind(stockfish));
  }

  onEngineOK() {
    console.info("onEngineOK");

    this.uci.setMultiPV(3);

    this.uci.onReceive("readyok", this.onEngineReady.bind(this));

    this.uci.isReady();

    this.uci.onReceive("info", this.onEngineInfo.bind(this), false);
    this.uci.onReceive("bestmove", this.onEngineBestMove.bind(this), false);
  }

  onEngineReady() {
    console.info("onEngineReady");

    //
    var fen = "";
    var moves = "";
    //
    var history = this.game.historyWithCorrectFen();
    for (var i = 0; i < history.length; i++) {
      //
      moves =
        moves + (moves !== "" ? " " : "") + history[i].from + history[i].to;
    }

    console.info("moves", moves);

    // remember the FEN we are calculating for
    this.engineFen = this.currentFen;

    console.info("starting evaluation using settings:");
    console.info(this.settings);

    // start the evaluation
    this.uci.evaluate(fen, moves, this.settings.repertoire_engine_time * 1000);
  }

  onEngineInfo(info) {
    // if for an old position
    if (this.currentFen !== this.engineFen) {
      return false;
    }

    // get the san moves
    var moves = [];
    var line = "";

    console.info(info);

    // make sure we have a line
    if (info.pv && info.pv.length) {
      try {
        // show the depth
        if (info.depth) {
          this.engineDepth.innerHTML = "Depth " + info.depth;
        }

        // create a game
        var game = new MyChess();
        game.load(this.currentFen);

        // go through the moves
        for (var i = 0; i < info.pv.length; i++) {
          game.move({
            from: info.pv[i].substring(0, 2),
            to: info.pv[i].substring(2, 4),
            promotion: info.pv[i].length == 5 ? info.pv[i].substring(4, 5) : "",
          });

          var last = game.history({ verbose: true }).pop();

          moves.push(last);

          line = line + (line !== "" ? " " : "") + last.san;
        }
      } catch (err) {
        console.error("Error:", err, info);
      }
    }

    var multipv = parseInt(info["multipv"]);
    var row;

    // if we already have this row
    if (this.engineTable.rows.length > multipv - 1) {
      // get the row
      row = this.engineTable.rows[multipv - 1];
    } else {
      // add the row
      row = this.engineTable.insertRow(-1);
      row.className =
        "overflow-hidden hover:cursor-pointer hover:bg-tacao-100 hover:dark:bg-slate-600";

      var cell = row.insertCell(-1);
      cell.className =
        "p-2 font-semibold whitespace-nowrap tc-base rounded-l-md";

      cell = row.insertCell(-1);
      cell.className = "w-full p-2 tc-base rounded-r-md";

      // add event listeners
      row.addEventListener("mouseover", (event) => {
        // make sure we have the row as target
        var targ = event.target;
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
        var targ = event.target;
        while (targ.parentNode && targ.tagName.toLowerCase() != "tr") {
          targ = targ.parentNode;
        }

        // only make the move if the table is not disabled (if it is, the moves are being loaded)
        if (!targ.parentNode.parentNode.disabled) {
          // get the move
          var move = targ.dataset.move;
          // turn the engine off
          this.engineCheckbox.checked = false;
          this.onEngineToggle();
          // goto this move
          this.clickMove(move);
        }
      });
    }

    // we need to invert the score if it's the opposite color move
    //var invert =
    //(this.board.getOrientation() == COLOR.white && this.currentTurn == "b") ||
    //(this.board.getOrientation() == COLOR.black && this.currentTurn == "w");
    // we need to invert if it's blacks turn (centipawn is always from the engine's pov)
    var invert = this.currentTurn == "b";

    // invert the centipawn and mate values
    var cp =
      info.score.cp !== null && invert ? info.score.cp * -1 : info.score.cp;
    var mate =
      info.score.mate !== null && invert
        ? info.score.mate * -1
        : info.score.mate;
    // get the score
    var score =
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

  onEngineBestMove(bestMove) {
    console.info("onEngineBestMove", bestMove);
  }

  /**
   * Group (tags) functions.
   */

  // remove the group tags
  clearGroupTags() {
    while (this.repertoireGroupTagsContainer.firstChild) {
      this.repertoireGroupTagsContainer.removeChild(
        this.repertoireGroupTagsContainer.lastChild
      );
    }
  }

  // add the group tags
  addGroupTags() {
    for (var i = 0; i < this.repertoireGroups.length; i++) {
      this.addGroupTag(this.repertoireGroups[i]);
    }
  }

  //
  addGroupTag(group, save = false) {
    // see if the group is already added
    for (
      var i = 0;
      i < this.repertoireGroupTagsContainer.children.length;
      i++
    ) {
      if (
        this.repertoireGroupTagsContainer.children[i].children[0].innerHTML ==
        group.name
      ) {
        return false;
      }
    }

    //
    var el = document.createElement("span");
    el.className =
      "flex items-center mr-1 rounded py-1 px-2 bg-secondary-100 border border-secondary-300";
    el.setAttribute("data-id", group.id);
    el.setAttribute("data-type", "tag");

    var txt = document.createElement("span");
    txt.className = "text-xs mr-2 font-semibold text-secondary-800";
    txt.innerHTML = group.name;

    el.appendChild(txt);

    var btn = document.createElement("button");
    btn.className =
      "button is-small";
    btn.innerHTML = '<span class="icon"><i class="fa-solid fa-trash"></i></span>';
    btn.addEventListener("click", this.onRepertoireGroupRemove.bind(this));

    el.appendChild(btn);

    this.repertoireGroupTagsContainer.appendChild(el);

    // if we need to save it
    if (save) {
      // save the repertoire group
      this.saveRepertoireGroup(group);
      // add to the groups array
      var add = true;
      for (var i = 0; i < this.groups.length; i++) {
        if (this.groups[i].name == group.name) {
          add = false;
          break;
        }
      }
      if (add) {
        this.groups.push({ id: 0, name: group.name });
      }
    }

    //repertoireGroupTagsContainer
  }

  // onChange event for repertoire autoplay checkbox
  onRepertoireAutoPlayChange(event) {
    // set the data object
    var data = {
      repertoire: this.repertoireId,
      autoplay: this.repertoireAutoPlayCheckbox.checked,
    };

    // send the API request
    var url = "/api/repertoire/autoplay";
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
    var data = {
      repertoire: this.repertoireId,
      exclude: this.repertoireExcludeCheckbox.checked,
    };

    // send the API request
    var url = "/api/repertoire/exclude";
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
    if (this.repertoireGroupInput.value != "") {
      for (var i = 0; i < this.groupsWithEco.length; i++) {
        if (this.repertoireGroupInput.value == this.groupsWithEco[i].name) {
          // add the group
          this.addGroupTag(this.groupsWithEco[i], true);

          this.repertoireGroupInput.value = "";
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
      for (var i = 0; i < this.groupsWithEco.length; i++) {
        if (this.repertoireGroupInput.value == this.groupsWithEco[i].name) {
          // add the group
          this.addGroupTag(this.groupsWithEco[i], true);

          this.repertoireGroupInput.value = "";

          return;
        }
      }

      // add the (new) group tag
      this.addGroupTag({ id: 0, name: this.repertoireGroupInput.value }, true);

      this.repertoireGroupInput.value = "";
    }
  }

  // event when the remove tag button is clicked
  onRepertoireGroupRemove(event) {
    // find the tag
    var tag = event.target.parentNode;
    while (tag.parentNode) {
      if (tag.getAttribute("data-type") === "tag") {
        // get the group name
        var groupName = tag.children[0].innerHTML;
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
    var data = {
      repertoire: this.repertoireId,
      group: group.name,
    };

    // send the API request
    var url = "/api/repertoire/group";
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
    var data = {
      repertoire: this.repertoireId,
      group: groupName,
    };

    // send the API request
    var url = "/api/repertoire/group";
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
    var hasMoved =
      (this.color == "white" &&
        (this.game.moveNumber() > 1 || this.game.turn() == "b")) ||
      (this.color == "black" && this.game.moveNumber() > 1);

    // toggle the save repertoire button
    this.toggleSaveRepertoire(!saved && hasMoved);

    var ourTurn =
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
    this.saveRepertoireButton.disabled = !enabled;
  }

  // save the current path to your repertoire (color, starting position, move, end position)
  onSaveRepertoire() {
    var pgn = "";
    var moves = this.game.historyWithCorrectFen();
    for (var i = 0; i < moves.length; i++) {
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];
      moves[i]["pgn"] = pgn;
      pgn += " ";
    }

    // set the data object
    var data = {
      color: this.color,
      initialFen: this.initialFen,
      moves: moves,
    };

    // send the API request
    var url = "/api/repertoire";
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
    this.repertoireContainer.classList.remove("is-hidden");
  }

  // hide the repertoire details
  hideRepertoireDetails() {
    this.repertoireContainer.classList.add("is-hidden");
  }

  /**
   * Moves table functions.
   */

  // clear the moves table
  clearMovesTable() {
    this.movesTable.disabled = true;
    this.movesTable.classList.add("opacity-50");
  }

  // load the moves table
  loadMovesTable(data) {
    // remove all current moves
    while (this.movesTable.tBodies[0].rows.length > 0) {
      this.movesTable.tBodies[0].deleteRow(0);
    }

    this.movesTable.disabled = false;
    this.movesTable.classList.remove("opacity-50");

    // add the repertoire moves
    for (var i = 0; i < data.repertoire.length; i++) {
      var params = {
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
    for (var i = 0; i < data.games.moves.length; i++) {
      // if not in our repertoire
      if (data.games.moves[i].repertoire == 0) {
        this.movesAddRow(data.games.moves[i]);
      }
    }

    // toggle no moves found text
    if (this.movesTable.tBodies[0].rows.length > 0) {
      this.movesTable.parentNode.firstElementChild.classList.add("is-hidden");
    } else {
      this.movesTable.parentNode.firstElementChild.classList.remove("is-hidden");
    }
  }

  // add a row to the moves table
  movesAddRow(data) {
    var row = this.movesTable.tBodies[0].insertRow(-1);
    row.className =
      "moves-row";
    row.setAttribute("data-move", data.move);

    var cell = row.insertCell(-1);
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
      var wpct = Math.round((data.wins / data.total) * 100);
      var lpct = Math.round((data.losses / data.total) * 100);
      var dpct = Math.max(0, 100 - wpct - lpct);

      var flex = document.createElement("div");
      flex.className = "win-draw-loss-bar";
      flex.title = this.getNumberOfGames(data.total);

      var div1 = document.createElement("div");
      div1.className = "win-bar";
      div1.innerHTML = wpct + "%";
      div1.style = "width: " + wpct + "%;";

      var div2 = document.createElement("div");
      div2.className = "draw-bar";
      //div2.innerHTML = dpct + "%";
      div2.style = "width: " + dpct + "%;";

      var div3 = document.createElement("div");
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
      var targ = event.target;
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
      var targ = event.target;
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
    for (var i = 0; i < this.movesTable.tBodies[0].rows.length; i++) {
      this.movesTable.tBodies[0].rows[i].cells[5].innerHTML = "";
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
        var last = this.game.history({ verbose: true }).pop();

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
    this.initialFenContainer.classList.remove("is-hidden");
  }

  hideInitialFens() {
    this.initialFenContainer.classList.add("is-hidden");
  }

  loadInitialFens(data) {
    while (this.initialFenSelect.firstChild) {
      this.initialFenSelect.removeChild(this.initialFenSelect.lastChild);
    }

    var opt = document.createElement("option");
    opt.value = "";
    opt.text = "default";

    this.initialFenSelect.appendChild(opt);

    for (var i = 0; i < data.length; i++) {
      opt = document.createElement("option");
      opt.value = data[i];
      opt.text = data[i];
      opt.selected = data[i] == this.initialFen;

      this.initialFenSelect.appendChild(opt);
    }
  }

  onSelectInitialFen(event) {
    // set the initial fen
    this.initialFen = this.initialFenSelect.value;

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
    // update the status, get the ECO codes for next position.. etc
    this.updateStatus();
  }

  afterGotoMove(moveNr, variationIdx) {
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
    var status = "";

    var moveColor = "White";
    if (this.game.turn() === "b") {
      moveColor = "Black";
    }

    console.log(this.game);

    // checkmate?
    if (this.game.isCheckmate()) {
      status = "Game over, " + moveColor + " is in checkmate.";
    }

    // draw?
    else if (this.game.isDraw()) {
      status = "Game over, drawn position";
    }

    // game still on
    else {
      status = moveColor + " to move";

      // check?
      if (this.game.isCheck()) {
        status += ", " + moveColor + " is in check";
      }
    }

    this.statusField.innerHTML = status;

    // remember the current FEN (without any preview moves, etc)
    this.currentFen = this.getFen();
    this.currentTurn = this.game.turn();
    // update the pgn field
    this.updatePgnField();
    // toggle the goto first move button
    this.gotoFirstButton.disabled = this.currentMove == 0;

    // get the moves for the new position
    this.getMoves();
  }
}

// initialise the Repertoire object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  // instantiate the repertoire class
  var repertoire = new Repertoire();
});
