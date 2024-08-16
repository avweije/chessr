import { MyChessBoard, BOARD_STATUS } from "./chessboard.js";
import { MyChess } from "./chess.js";
import { COLOR } from "cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "cm-chessboard/src/extensions/markers/Markers.js";
import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

import "../styles/chessboard.css";

/**
 * Controller class for the practice page.
 */
class Practice extends MyChessBoard {
  type = "all";
  types = ["white", "black", "new", "recommended", "all", "analysis"];

  buttons = {
    repertoireType: null,
    startPractice: null,
    giveHint: null,
    skipMove: null,
  };

  containers = {
    group: null,
    groupSelect: null,

    counters: null,
    moveCounter: null,
    correctCounter: null,
    failedCounter: null,

    info: null,
    confirm: null,
    warning: null,
  };

  pgnContainer = null;

  playedMovesContainer = null;
  playedMovesList = null;

  inPractice = false;

  repertoire = [];
  needsRefresh = false;

  lastMove = null;
  correctMoves = [];

  practice = {
    lines: [],
    moveCount: 0,
    lineIdx: 0,
    moveIdx: 0,
    failedCount: 0,
    lineColor: "",
    lineMoves: [],
    lineMovesMultiple: [],
    lineMovesPlayable: [],
    isMultiple: false,
    lineMovesPlayed: [],
    initialFen: "",
    currentFen: "",
    animateToPosition: true,
    stopAnimating: false,
    paused: false,
    pausedFen: "",
  };

  hintCounter = 0;

  analysis = {
    buttons: null,
    container: null,
    fields: null,
    saveButton: null,
    ignoreButton: null,
    discardButton: null,
    saveDialog: null,
    ignoreDialog: {},
    saveDialog: {},
  };

  constructor() {
    super();

    // show the page loader
    Utils.showLoading();

    // get the board element
    var el = document.getElementById("board");
    // get the practice type
    this.type = el.getAttribute("data-type");

    // get the practice type buttons
    this.buttons.repertoireType = document.getElementById(
      "practiceRepertoireButtons"
    );

    // get the save practice button
    this.buttons.startPractice = document.getElementById("startPracticeButton");
    this.buttons.giveHint = document.getElementById("giveHintButton");
    this.buttons.skipMove = document.getElementById("skipMoveButton");

    // get the counter elements
    this.containers.group = document.getElementById("practiceGroupContainer");
    this.containers.groupSelect = document.getElementById(
      "practiceGroupSelect"
    );

    this.containers.groupSelect.addEventListener(
      "change",
      this.onGroupSelectChange.bind(this)
    );

    this.containers.counters = document.getElementById(
      "practiceCountersContainer"
    );
    this.containers.moveCounter = document.getElementById(
      "practiceMoveCounter"
    );
    this.containers.correctCounter = document.getElementById(
      "practiceCorrectCounter"
    );
    this.containers.failedCounter = document.getElementById(
      "practiceFailedCounter"
    );
    // get the status containers
    this.containers.info = document.getElementById("infoContainer");
    this.containers.confirm = document.getElementById("confirmContainer");
    this.containers.warning = document.getElementById("warningContainer");
    // get the played moves container & list
    this.playedMovesContainer = document.getElementById("playedMovesContainer");
    this.playedMovesList = document.getElementById("playedMovesList");

    this.pgnContainer = document.getElementById("pgnContainer");

    // set the pgn field
    this.setPgnField(document.getElementById("pgnField"));

    // attach click handler to the repertoire type buttons
    this.initRepertoireButtons();

    // attach click handler to the start practice button
    this.buttons.startPractice.addEventListener(
      "click",
      this.onStartPractice.bind(this)
    );
    this.buttons.giveHint.addEventListener("click", this.giveHint.bind(this));
    this.buttons.skipMove.addEventListener("click", this.skipMove.bind(this));

    // create the chess board
    this.init(el, this.type == "black" ? COLOR.black : COLOR.white);

    // disable move input
    this.disableMoveInput();

    // get the entire repertoire
    this.getRepertoire(true);

    // initialise the analysis elements
    this.initAnalysis();

    // initialise the dialogs
    this.initDialogs();

    // add keydown event listeners for left/right (prev/next move)
    document.addEventListener("keydown", (event) => {
      // if arrow left or right and the focus is not on an input element
      if (
        this.practice.paused &&
        (event.key == "ArrowRight" || event.key == "ArrowLeft") &&
        (!document.activeElement ||
          !["INPUT", "SELECT", "TEXTAREA"].includes(
            document.activeElement.nodeName
          ))
      ) {
        console.log("keydown:");
        console.log(event);
        console.log(document.activeElement);

        if (event.key == "ArrowRight") {
          this.gotoNext();
        } else {
          this.gotoPrevious();
        }
      }
    });

    // hide the page loader
    Utils.hideLoading();
  }

  initAnalysis() {
    // get the elements
    this.analysis.buttons = document.getElementById("analysisGameButtons");
    this.analysis.container = document.getElementById("analysisGameContainer");
    this.analysis.fields = document.getElementById("analysisGameFields");
    this.analysis.saveButton = document.getElementById("analysisSaveButton");
    this.analysis.ignoreButton = document.getElementById(
      "analysisIgnoreButton"
    );
    this.analysis.discardButton = document.getElementById(
      "analysisDiscardButton"
    );

    // add the event listeners
    this.analysis.saveButton.addEventListener(
      "click",
      this.onAnalysisSave.bind(this)
    );
    this.analysis.ignoreButton.addEventListener(
      "click",
      this.onAnalysisIgnore.bind(this)
    );
    this.analysis.discardButton.addEventListener(
      "click",
      this.onAnalysisDiscard.bind(this)
    );
  }

  initDialogs() {
    // get the save modal elements
    this.analysis.saveDialog.modal = document.getElementById("saveModal");
    this.analysis.saveDialog.closeButton = document.getElementById(
      "saveModalCloseButton"
    );
    this.analysis.saveDialog.cancelButton = document.getElementById(
      "saveModalCancelButton"
    );
    this.analysis.saveDialog.confirmButton = document.getElementById(
      "saveModalConfirmButton"
    );

    this.analysis.saveDialog.textOneMove = document.getElementById(
      "saveModalTextOneMove"
    );
    this.analysis.saveDialog.textMultipleMoves = document.getElementById(
      "saveModalTextMultipleMoves"
    );
    this.analysis.saveDialog.movesList =
      document.getElementById("saveModalMovesList");

    this.analysis.saveDialog.radioTopMove = document.getElementById(
      "saveModalRadioTopMove"
    );
    this.analysis.saveDialog.radioTop2 =
      document.getElementById("saveModalRadioTop2");
    this.analysis.saveDialog.radioTop3 =
      document.getElementById("saveModalRadioTop3");

    // register the modal
    Modal.register(this.analysis.saveDialog.modal, [
      {
        element: this.analysis.saveDialog.closeButton,
        action: "close",
      },
      {
        element: this.analysis.saveDialog.cancelButton,
        action: "close",
      },
      {
        element: this.analysis.saveDialog.confirmButton,
        action: "handler",
        handler: this.onAnalysisSaveConfirmed.bind(this),
      },
    ]);

    // get the ignore modal elements
    this.analysis.ignoreDialog.modal = document.getElementById("ignoreModal");
    this.analysis.ignoreDialog.closeButton = document.getElementById(
      "ignoreModalCloseButton"
    );
    this.analysis.ignoreDialog.cancelButton = document.getElementById(
      "ignoreModalCancelButton"
    );
    this.analysis.ignoreDialog.confirmButton = document.getElementById(
      "ignoreModalConfirmButton"
    );

    // register the modal
    Modal.register(this.analysis.ignoreDialog.modal, [
      {
        element: this.analysis.ignoreDialog.closeButton,
        action: "close",
      },
      {
        element: this.analysis.ignoreDialog.cancelButton,
        action: "close",
      },
      {
        element: this.analysis.ignoreDialog.confirmButton,
        action: "handler",
        handler: this.onAnalysisIgnoreConfirmed.bind(this),
      },
    ]);
  }

  /**
   * chessboard.js event handlers
   */

  afterMove(move) {
    try {
      // if practice is paused..
      if (this.practice.paused) {
        return true;
      }

      // get the last move
      this.lastMove = this.game.historyWithCorrectFen().pop();

      // is this the correct repertoire move?
      var isCorrect = this.practice.lineMoves.includes(this.lastMove.san);

      // if this is the correct move
      if (isCorrect) {
        // highlight the correct move
        this.board.removeMarkers();
        this.board.addMarker(this.markers.checkmark, move.to);
        this.board.addMarker(this.markers.squareGreen, move.from);
        this.board.addMarker(this.markers.squareGreen, move.to);

        // handle the next steps
        this.correctMovePlayed();
      } else {
        // update the status
        this.showWarning("That's not the correct move. Try again.");

        // if not already failed
        if (this.practice.failedCount == 0) {
          // add to the failed counter
          this.addFailedCount();

          // add to the failed count
          var failed = [];

          // if we have multiple moves here
          if (this.practice.isMultiple) {
            // add only the moves that had not yet been played correctly
            for (var i = 0; i < this.practice.lineMoves.length; i++) {
              if (
                !this.practice.lineMovesPlayed.includes(
                  this.practice.lineMoves[i]
                )
              ) {
                failed.push({
                  color: this.practice.lineColor,
                  fen: this.lastMove.before,
                  move: this.practice.lineMoves[i],
                  failed: 1,
                });
              }
            }
          } else {
            // add the move
            failed.push({
              color: this.practice.lineColor,
              fen: this.lastMove.before,
              move: this.practice.lineMoves[0],
              failed: 1,
            });
          }

          // save the move counters
          if (failed.length > 0) {
            this.saveMoveCounters(failed);
          }
        } else if (this.practice.isMultiple) {
          // already failed before - only add to the counter if we have multiple moves that we failed
          if (
            this.practice.failedCount + this.practice.lineMovesPlayed.length <
            this.practice.lineMoves.length
          ) {
            // add to the failed counter
            this.addFailedCount();
          }
        }

        // remember how many times we failed this move
        this.practice.failedCount++;

        // highlight the error move
        this.board.removeMarkers();
        this.board.addMarker(this.markers.cancel, move.to);
        this.board.addMarker(this.markers.squareRed, move.from);
        this.board.addMarker(this.markers.squareRed, move.to);

        // pause the board for a moment
        this.pauseBoard(() => {
          // reset position
          //this.game.undo();
          //this.board.setPosition(this.game.fen());
          this.gameUndo();
          // remove markers
          this.board.removeMarkers();
          // wait on the next move
          this.waitOnMove();
        });
      }

      return true;
    } catch (err) {
      console.log(err);

      return false;
    }
  }

  /**
   * Pgn Container functions.
   */

  showPgnContainer() {
    this.pgnContainer.classList.remove("hidden");
  }

  hidePgnContainer() {
    this.pgnContainer.classList.add("hidden");
  }

  /**
   * Analysis functions.
   * - showAnalysis
   * - hideAnalysis
   * - onAnalysisSave
   * - onAnalysisSaveConfirmed
   * - onAnalysisIgnore
   * - onAnalysisIgnoreConfirmed
   * - onAnalysisDiscard
   * - analysisFieldsUpdate
   */

  showAnalysis() {
    // show the analysis container
    this.analysis.buttons.classList.remove("hidden");
    this.analysis.container.classList.remove("hidden");
    // enable the buttons
    this.analysis.saveButton.disabled = false;
    this.analysis.ignoreButton.disabled = false;
    this.analysis.discardButton.disabled = false;
  }

  hideAnalysis() {
    // hide the analysis container
    this.analysis.buttons.classList.add("hidden");
    this.analysis.container.classList.add("hidden");
    // disable the buttons
    this.analysis.saveButton.disabled = true;
    this.analysis.ignoreButton.disabled = true;
    this.analysis.discardButton.disabled = true;
  }

  // fired when the analysis save to repertoire button is clicked
  onAnalysisSave(event) {
    console.log("onAnalysisSave:");
    console.log(this.practice.lines[this.practice.lineIdx]);

    // configure the save dialog
    switch (this.practice.lines[this.practice.lineIdx].moves.length) {
      case 1:
        this.analysis.saveDialog.textOneMove.classList.remove("hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.add("hidden");
        this.analysis.saveDialog.movesList.classList.add("hidden");
        this.analysis.saveDialog.movesList.classList.add("sm:hidden");
        break;
      case 2:
        this.analysis.saveDialog.textOneMove.classList.add("hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("sm:hidden");
        this.analysis.saveDialog.radioTop2.parentNode.parentNode.classList.remove(
          "hidden"
        );
        this.analysis.saveDialog.radioTop3.parentNode.parentNode.classList.add(
          "hidden"
        );
        break;
      case 3:
        this.analysis.saveDialog.textOneMove.classList.add("hidden");
        this.analysis.saveDialog.textMultipleMoves.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("hidden");
        this.analysis.saveDialog.movesList.classList.remove("sm:hidden");
        this.analysis.saveDialog.radioTop2.parentNode.parentNode.classList.remove(
          "hidden"
        );
        this.analysis.saveDialog.radioTop3.parentNode.parentNode.classList.remove(
          "hidden"
        );
        break;
    }

    this.analysis.saveDialog.radioTopMove.checked = true;

    // show the modal
    Modal.open(this.analysis.saveDialog.modal);
  }

  // fired when the save dialog is confirmed
  onAnalysisSaveConfirmed() {
    console.log("onAnalysisSaveConfirmed:");
    console.log(this.practice.lines[this.practice.lineIdx]);

    // get a game with the moves
    var game = this.getCurrentGame();

    // get the moves
    var pgn = "";
    var moves = game.historyWithCorrectFen();

    for (var i = 0; i < moves.length; i++) {
      if (i % 2 == 0) {
        pgn += i / 2 + 1 + ". ";
      }
      pgn += moves[i]["san"];

      moves[i]["pgn"] = pgn;
      moves[i]["autoplay"] = true;

      pgn += " ";
    }

    // add the engine moves
    var addIf = [
      true,
      this.analysis.saveDialog.radioTop2.checked ||
        this.analysis.saveDialog.radioTop3.checked,
      this.analysis.saveDialog.radioTop3.checked,
    ];
    var engineMoves = [];
    for (
      var i = 0;
      i < this.practice.lines[this.practice.lineIdx].moves.length;
      i++
    ) {
      // if we need to add this move
      if (addIf[i]) {
        // make the move
        game.move(this.practice.lines[this.practice.lineIdx].moves[i].move);
        // get the move details
        var last = game.historyWithCorrectFen().pop();
        // set the PGN value
        last["pgn"] = pgn + last["san"];
        // add to the engine moves array
        engineMoves.push(last);
        // undo the move
        game.undo();
      }
    }

    console.log("Moves:");
    console.log(engineMoves);

    // add the engine moves
    moves.push({ moves: engineMoves });

    // we need to refresh the repertoire data when starting a new practice
    this.needsRefresh = true;

    // set the API url
    var url = "/api/analysis/save";

    // set the data object
    var data = {
      color: this.practice.lines[this.practice.lineIdx].color,
      initialFen: this.practice.lines[this.practice.lineIdx].initialFen,
      fen: this.practice.lines[this.practice.lineIdx].fen,
      move: this.practice.lines[this.practice.lineIdx].move,
      moves: moves,
    };

    // delete the analysis move
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
      .catch((error) => {
        console.error("Error:", error);
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    Modal.close(this.analysis.saveDialog.modal);
  }

  // get the current game with the moves for this line
  getCurrentGame() {
    // create a new chess game
    var game = new MyChess();
    // get the initial fen
    var initialFen = this.practice.lines[this.practice.lineIdx].initialFen
      ? this.practice.lines[this.practice.lineIdx].initialFen
      : "";
    // reset the game
    if (initialFen != "") {
      game.load(initialFen);
    }

    // play the line moves
    for (
      var i = 0;
      i < this.practice.lines[this.practice.lineIdx].line.length;
      i++
    ) {
      game.move(this.practice.lines[this.practice.lineIdx].line[i]);
    }

    // play the current move (that is the mistake move, don't add this)
    //game.move(this.practice.lines[this.practice.lineIdx].move);

    return game;
  }

  // fired when the analysis ignore button is clicked
  onAnalysisIgnore(event) {
    // show the modal
    Modal.open(this.analysis.ignoreDialog.modal);
  }

  // fired when the ignore dialog is confirmed
  onAnalysisIgnoreConfirmed() {
    // set the API url
    var url = "/api/analysis/ignore";
    // set the data
    var data = {
      fen: this.practice.lines[this.practice.lineIdx].fen,
      move: this.practice.lines[this.practice.lineIdx].move,
    };

    // delete the analysis move
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
      .catch((error) => {
        console.error("Error:", error);
      });

    // remove from the current practice lines
    this.onAnalysisDiscard(null, false);

    // close the modal
    Modal.close(this.analysis.ignoreDialog.modal);
  }

  // fired when the analysis discard button is clicked
  onAnalysisDiscard(event, removeFromDb = true) {
    // we need to refresh the repertoire data when starting a new practice
    this.needsRefresh = true;

    // if we need to remove this move from the database
    if (removeFromDb) {
      //if (false) {
      // set the API url
      var url = "/api/analysis";
      // set the data
      var data = {
        fen: this.practice.lines[this.practice.lineIdx].fen,
        move: this.practice.lines[this.practice.lineIdx].move,
      };

      // delete the analysis move
      fetch(url, {
        method: "DELETE",
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
        .catch((error) => {
          console.error("Error:", error);
        });
    }

    // the FEN & move we need to delete
    var fen = this.practice.lines[this.practice.lineIdx].fen;
    var move = this.practice.lines[this.practice.lineIdx].move;

    // reduce by number of moves counter
    var reduceBy = 0;
    var reduceTotal = 0;
    for (var i = 0; i < this.practice.lines.length; i++) {
      // if this is the same move
      if (
        this.practice.lines[i].fen == fen &&
        this.practice.lines[i].move == move
      ) {
        // increase the reduce by counter by the number of moves we're skipping
        reduceBy =
          reduceBy +
          (i == this.practice.lineIdx
            ? this.practice.lineMoves.length -
              this.practice.lineMovesPlayed.length
            : this.practice.lines[i].moves.length);
        reduceTotal = reduceTotal + this.practice.lines[i].moves.length;

        console.log(
          "-- discard, line found: " +
            i +
            ", idx = " +
            this.practice.lineIdx +
            ", reduce = " +
            reduceBy
        );

        // remove this line
        this.practice.lines.splice(i, 1);

        // adjust the current line index if this line comes before it
        if (i < this.practice.lineIdx) {
          this.practice.lineIdx = this.practice.lineIdx - 1;
        }

        i = i - 1;
      }
    }

    // update the move counter
    if (reduceBy > 0) {
      this.reduceMoveCount(reduceBy);
    }
    if (reduceTotal > 0) {
      this.practice.moveCount = this.practice.moveCount - reduceTotal;
    }

    // proceed to the 1st move of the next line (current line was removed, so no need to increase line index)
    this.practice.moveIdx = 0;

    // animate to the next position
    this.practice.animateToPosition = true;

    // continue the practice
    this.continuePractice(false);
  }

  // update the analysis game fields
  analysisFieldsUpdate() {
    // safety check
    if (this.practice.lines[this.practice.lineIdx] == undefined) {
      return;
    }

    // set the opponent name
    this.analysis.fields.children[1].innerHTML =
      this.practice.lines[this.practice.lineIdx].color == "white"
        ? this.practice.lines[this.practice.lineIdx].black
        : this.practice.lines[this.practice.lineIdx].white;
    // set the move that was played
    this.analysis.fields.children[3].innerHTML =
      this.practice.lines[this.practice.lineIdx].move +
      " (" +
      this.practice.lines[this.practice.lineIdx].type +
      ")";
    // set the game link
    this.analysis.fields.children[7].href =
      this.practice.lines[this.practice.lineIdx].link;
    this.analysis.fields.children[7].innerHTML =
      this.practice.lines[this.practice.lineIdx].link;

    // if we have an initial fen
    if (
      this.practice.lines[this.practice.lineIdx].initialFen &&
      this.practice.lines[this.practice.lineIdx].initialFen != ""
    ) {
      // show the initial fen fields
      this.analysis.fields.children[4].classList.remove("hidden");
      this.analysis.fields.children[5].classList.remove("hidden");

      // set the initial fen
      this.analysis.fields.children[5].innerHTML =
        this.practice.lines[this.practice.lineIdx].initialFen;
    } else {
      // hide the initial fen fields
      this.analysis.fields.children[4].classList.add("hidden");
      this.analysis.fields.children[5].classList.add("hidden");
    }
  }

  /**
   * Practice handling functions.
   * - onMoveFinished
   * - pausePractice
   * - continuePractice
   * - gotoNextMove
   * - gotoNextLine
   * - onFinishPractice
   */

  /**
   * Called once a move is finished. If there is only 1 move for a position, it's called after that move
   * is played correctly. If there are multiple correct moves for this position, this function is called once
   * all those moves have been played correctly.
   *
   * Here you decide what to do next:
   * - goto the next move (or line)
   * - pause until the user says to continue
   * - etc
   *
   * @memberof Practice
   */
  onMoveFinished(action = "pause") {
    console.log("onMoveFinished: " + action);

    // currently not waiting on move
    this.practice.waitingOnMove = false;

    // if this is an analysis line
    if (this.type == "analysis") {
      // update the board status
      this.setStatus(BOARD_STATUS.waitingOnMove);

      // wait before proceeding to the next line
      action = "wait";

      // remember the current position
      this.practice.pausedFen = this.game.fen();

      // undo the current move after a short pause (unless the user already continued)
      this.pauseBoard(() => {
        // if still paused
        if (this.practice.paused) {
          // if we still have the same position
          if (
            this.practice.pausedFen == this.game.fen() &&
            this.practice.isMultiple
          ) {
            // undo the last move
            //this.game.undo();
            //this.board.setPosition(this.game.fen());
            this.gameUndo();
          }
          // remove markers
          this.board.removeMarkers();
        }
      }, 1500);
    } else {
      // update the board status
      this.setStatus(BOARD_STATUS.default);
    }

    switch (action) {
      case "continue":
        // continue the practice
        this.continuePractice();
        break;
      case "wait":
        // wait for user interaction before continueing
        this.pausePractice();
        break;
      default:
        // pause for a moment before continueing
        this.pauseBoard(() => {
          // continue the practice
          this.continuePractice();
        }, 1300);
        break;
    }
  }

  // pause the practice
  pausePractice() {
    this.practice.paused = true;

    // set the skip move button text
    //this.buttons.skipMove.innerHTML = "Continue";
    this.buttons.skipMove.title = "Continue";
    // enable the pgn links
    this.setPgnWithLinks(true);
  }

  // continue the practice
  continuePractice(gotoNext = true) {
    // if practice was paused
    if (this.practice.paused) {
      // set the skip move button text
      //this.buttons.skipMove.innerHTML = "Skip this move";
      this.buttons.skipMove.title = "Skip this move";
      // disable the pgn links
      this.setPgnWithLinks(false);
    }

    this.practice.paused = false;

    // hide the played moves list
    //this.hidePlayedMoves();
    // remove markers
    this.board.removeMarkers();

    // goto the next move or line
    if (gotoNext) {
      if (this.practice.isMultiple) {
        this.gotoNextLine(true);
      } else {
        this.gotoNextMove(true);
      }
    } else {
      this.runPractice();
    }
  }

  // goto the next move
  gotoNextMove(animate = this.practice.animateToPosition) {
    // goto the next move
    this.practice.moveIdx++;

    this.practice.animateToPosition = animate;

    this.runPractice();
  }

  // goto the next line
  gotoNextLine(animate = this.practice.animateToPosition) {
    // goto the next line
    this.practice.lineIdx++;
    this.practice.moveIdx = 0;

    this.practice.animateToPosition = animate;

    this.runPractice();
  }

  // called when a practice is finished, all moves played
  // show info ? toggle buttons, etc..
  onFinishPractice() {}

  /**
   * Repertoire functions:
   * - getRepertoire
   * - onGetRepertoire
   * - showRepertoireType
   * - initRepertoireButtons
   * - toggleRepertoireButtons
   */

  // get the repertoire
  getRepertoire(refresh = this.needsRefresh) {
    // no need to refresh after this
    this.needsRefresh = false;
    // if we need to refresh
    if (refresh) {
      var url = "/api/practice";

      // show the page loader
      Utils.showLoading();

      fetch(url, {
        method: "GET",
      })
        .then((res) => res.json())
        .then((response) => {
          console.log("Success:");
          console.log(response);

          // enable the practice
          this.onGetRepertoire(response);
        })
        .catch((error) => console.error("Error:", error))
        .finally(() => {
          // hide the page loader
          Utils.hideLoading();
        });
    } else {
      // enable the practice
      this.onGetRepertoire(this.repertoire);
    }
  }

  // enable the practice
  onGetRepertoire(json, group = null) {
    this.repertoire = json;
    // enable the start practice button
    this.buttons.startPractice.disabled = false;

    // get the number of moves (ours) for the different repertoires
    var moveCounts = ["", "", 0, 0, "", 0];
    this.practice.lines = [];
    moveCounts[2] = this.getPracticeLines("new", this.repertoire["new"]);
    this.practice.lines = [];
    moveCounts[3] = this.getPracticeLines(
      "recommended",
      this.repertoire["recommended"]
    );
    this.practice.lines = [];
    moveCounts[5] = this.getPracticeLines(
      "analysis",
      this.repertoire["analysis"]
    );

    // toggle the repertoire type buttons
    this.toggleRepertoireButtons(moveCounts);

    // load the groups
    if (group == null) {
      this.loadGroups();
    }

    // get the right repertoire
    var rep =
      this.type == "all"
        ? group == null
          ? [...this.repertoire["white"], ...this.repertoire["black"]]
          : this.repertoire.groups[group].lines
        : this.repertoire[this.type];

    this.practice.lines = [];

    // get the practice lines
    this.practice.moveCount = this.getPracticeLines(this.type, rep);

    console.log("practiceLines: " + this.practice.moveCount);
    console.log(this.practice.lines);

    // show the counters
    this.showCounters(this.practice.moveCount);
  }

  // show a different repertoire type
  showRepertoireType(type) {
    // stop the current practice
    this.stopPractice();
    // set the type
    this.type = type;
    // reset the board
    this.game.reset();
    this.board.setPosition(this.game.fen());
    // remove the markers
    this.board.removeMarkers();
    // set the orientation
    var orient = this.type == "black" ? COLOR.black : COLOR.white;
    if (this.board.getOrientation() != orient) {
      this.board.setOrientation(orient);
    }

    // disable move input
    this.disableMoveInput();

    // refresh the repertoire
    this.getRepertoire();
  }

  // add event listeners to the repertoire type buttons
  initRepertoireButtons() {
    this.buttons.repertoireType.children[0].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("white");
      }
    );
    this.buttons.repertoireType.children[1].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("black");
      }
    );
    this.buttons.repertoireType.children[2].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("new");
      }
    );
    this.buttons.repertoireType.children[3].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("recommended");
      }
    );
    this.buttons.repertoireType.children[4].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("all");
      }
    );
    this.buttons.repertoireType.children[5].children[0].addEventListener(
      "click",
      (event) => {
        this.showRepertoireType("analysis");
      }
    );
  }

  // toggle the repertoire type buttons
  toggleRepertoireButtons(moveCounts) {
    console.log("toggleRepertoireButtons:");
    console.log(moveCounts);

    // toggle the repertoire type buttons
    this.buttons.repertoireType.children[0].children[0].disabled =
      this.repertoire.white.length == 0;
    this.buttons.repertoireType.children[1].children[0].disabled =
      this.repertoire.black.length == 0;
    this.buttons.repertoireType.children[2].children[0].disabled =
      this.repertoire.new.length == 0;
    this.buttons.repertoireType.children[3].children[0].disabled =
      this.repertoire.recommended.length == 0;
    this.buttons.repertoireType.children[4].children[0].disabled =
      this.repertoire.white.length == 0 && this.repertoire.black.length == 0;
    this.buttons.repertoireType.children[5].children[0].disabled =
      this.repertoire.analysis.length == 0;

    this.buttons.repertoireType.children[2].children[1].children[0].innerHTML =
      moveCounts[2];
    this.buttons.repertoireType.children[3].children[1].children[0].innerHTML =
      moveCounts[3];
    this.buttons.repertoireType.children[5].children[1].children[0].innerHTML =
      moveCounts[5];

    // select the right type
    var idx = this.types.indexOf(this.type);
    // set to "all" if there are no practice lines for this type
    if (
      idx == -1 ||
      this.buttons.repertoireType.children[idx].children[1].disabled
    ) {
      // check the checkbox
      this.buttons.repertoireType.children[4].children[0].checked = true;
    }

    // toggle the group select container
    if (
      this.buttons.repertoireType.children[4].children[0].checked &&
      this.repertoire.groups.length > 0
    ) {
      this.showGroups();
    } else {
      this.hideGroups();
    }
  }

  /**
   * Repertoire group functions. Select box with repertoire groups to practice.
   *
   * - loadGroups
   * - showGroups
   * - hideGroups
   */

  loadGroups() {
    // clear the moves list
    while (this.containers.groupSelect.lastChild) {
      this.containers.groupSelect.removeChild(
        this.containers.groupSelect.firstChild
      );
    }

    var opt = document.createElement("option");
    opt.value = "";
    opt.text =
      this.repertoire.groups.length == 0
        ? "No groups available"
        : "No group selected";

    this.containers.groupSelect.appendChild(opt);

    for (var i = 0; i < this.repertoire.groups.length; i++) {
      opt = document.createElement("option");
      //opt.value = this.repertoire.groups[i].id;
      opt.value = i;
      opt.text = this.repertoire.groups[i].name;

      this.containers.groupSelect.appendChild(opt);
    }
  }

  showGroups() {
    this.containers.group.classList.remove("hidden");
  }

  hideGroups() {
    this.containers.group.classList.add("hidden");
  }

  onGroupSelectChange(event) {
    console.log("onGroupSelectChange:");

    // stop the current practice
    this.stopPractice();
    // reset the board
    this.game.reset();
    this.board.setPosition(this.game.fen());
    // remove the markers
    this.board.removeMarkers();

    // disable move input
    this.disableMoveInput();

    // get the group repertoire
    this.onGetRepertoire(
      this.repertoire,
      this.containers.groupSelect.value == ""
        ? null
        : this.containers.groupSelect.value
    );
  }

  // split the repertoire into practice lines
  getPracticeLines(
    type,
    lines,
    color = "",
    lineMoves = [],
    add = true,
    isVariation = false,
    depth = 0
  ) {
    // keep track of how many moves there are for us
    var ourMoveTotal = 0;

    for (var i = 0; i < lines.length; i++) {
      // if a color is given
      if (color != "") {
        lines[i].color = color;
        lines[i].line = lineMoves;
      } else {
        lineMoves = lines[i].line;
      }

      // is this our move or not
      //var ourMove =
      //(lines[i].color == "white" && depth % 2 == 0) ||
      //(lines[i].color == "black" && depth % 2 == 1);
      var ourMove = depth % 2 == 0;

      var playableCnt = 0;
      if (ourMove) {
        for (var x = 0; x < lines[i].moves.length; x++) {
          if (!lines[i].moves[x].autoplay) {
            playableCnt++;
          }
        }
      }

      // the total moves for this line
      //var lineMoveTotal = ourMove ? this.type == "analysis" ? 1 : lines[i].moves.length : 0;
      var lineMoveTotal = ourMove ? playableCnt : 0;

      // if we need to add this line
      if (add) {
        // if this is a variation
        if (isVariation) {
          lines[i].variation = true;
        }
        // add the practice line
        this.practice.lines.push(lines[i]);
      }

      // if this line has moves that follow
      if (type != "analysis" && lines[i].moves.length > 0) {
        // add this move to the line moves array
        var line = lineMoves.slice(0);
        if (lines[i].move) {
          line.push(lines[i].move);
        }

        // get the practice lines
        var sub = this.getPracticeLines(
          type,
          lines[i].moves,
          lines[i].color != "" ? lines[i].color : color,
          line,
          lines[i].moves.length > 1,
          true,
          depth + 1
        );

        // if these are not split lines, include the total our moves
        if (lines[i].moves.length == 1) {
          lineMoveTotal += sub;
        } else {
          ourMoveTotal += sub;
        }
      }

      lines[i]["ourMoves"] = lineMoveTotal;

      ourMoveTotal += lineMoveTotal;
    }

    return ourMoveTotal;
  }

  /**
   * Practice functions.
   * - onStartPractice
   * - stopPractice
   * - runPractice
   */

  // start the practice
  async onStartPractice() {
    // reset vars
    this.practice.moveNr = 1;
    this.practice.lineIdx = 0;
    this.practice.moveIdx = 0;
    this.practice.lineColor = "";
    this.practice.lineMoves = [];
    this.practice.lineMovesMultiple = [];
    this.practice.lineMovesPlayed = [];
    this.practice.initialFen = "";
    this.practice.currentFen = "";
    this.practice.paused = false;
    this.practice.pausedFen = "";

    // set the skip move button text
    //this.buttons.skipMove.innerHTML = "Skip this move";
    this.buttons.skipMove.title = "Skip this move";

    // toggle the buttons
    this.buttons.startPractice.disabled = true;
    this.buttons.startPractice.classList.add("hidden");
    this.buttons.giveHint.disabled = false;
    this.buttons.giveHint.classList.remove("hidden");
    this.buttons.skipMove.disabled = false;
    this.buttons.skipMove.classList.remove("hidden");

    // reset the counters
    this.showCounters(this.practice.moveCount);

    // enable board move input
    this.disableMoveInput();
    this.enableMoveInput();

    // toggle the analysis container
    if (this.type == "analysis") {
      // show the pgn container
      this.showPgnContainer();
      // show the analysis container
      this.showAnalysis();
    }

    // animate to starting position
    this.practice.animateToPosition = true;

    // run the practice
    this.runPractice();

    return;
  }

  // stop a practice (when switching type)
  stopPractice() {
    // toggle the buttons
    this.buttons.startPractice.disabled = false;
    this.buttons.startPractice.innerHTML = "Start your practice";
    this.buttons.startPractice.classList.remove("hidden");
    this.buttons.giveHint.disabled = true;
    this.buttons.giveHint.classList.add("hidden");
    this.buttons.skipMove.disabled = true;
    this.buttons.skipMove.classList.add("hidden");

    // stop animating
    this.practice.stopAnimating = true;

    // reset the game & board
    this.game.reset();
    this.board.setPosition(this.game.fen());

    // hide the played moves container
    this.hidePlayedMoves();

    // toggle the analysis container
    if (this.type == "analysis") {
      // hide the pgn container
      this.hidePgnContainer();
      // hide the analysis container
      this.hideAnalysis();
    }

    // show info
    this.showInfo("To start your practice, click the button below.");
  }

  // run the practice
  async runPractice() {
    console.log(
      "runPractice: lineIdx = " +
        this.practice.lineIdx +
        ", moveIdx = " +
        this.practice.moveIdx +
        ", animate = " +
        this.practice.animateToPosition
    );

    // if we've completed all lines
    if (this.practice.lineIdx >= this.practice.lines.length) {
      // stop the current practice
      this.stopPractice();
      // update the status
      this.showInfo("You completed all the lines in this repertoire.");
      // set the button text
      this.buttons.startPractice.innerHTML = "Start again";

      return;
    }

    // reset user interruption boolean
    this.practice.stopAnimating = false;

    console.log(this.practice.lines[this.practice.lineIdx]);

    // if the line color changed, we need to reset the board
    var colorChanged =
      this.practice.lineColor !=
      this.practice.lines[this.practice.lineIdx].color;

    // get the line color
    this.practice.lineColor = this.practice.lines[this.practice.lineIdx].color;

    // get the next moves
    var [moves, multiple, playable] = this.getMoves();

    // if no more moves or next move for analysis line..
    if (
      playable.length == 0 ||
      (this.type == "analysis" && this.practice.moveIdx > 0)
    ) {
      // goto the next line
      this.gotoNextLine(true);

      return;
    }

    // set the practice line vars
    this.practice.isMultiple = moves.length > 1;
    this.practice.lineMoves = moves;
    this.practice.lineMovesMultiple = multiple;
    this.practice.lineMovesPlayable = playable;
    this.practice.lineMovesPlayed = [];
    this.practice.failedCount = 0;

    this.practice.current_lineIdx = this.practice.lineIdx;
    this.practice.current_moveIdx = this.practice.moveIdx;

    this.practice.skipped_lineIdx = -1;
    this.practice.skipped_moveIdx = -1;

    // reset the hint counter
    this.hintCounter = 0;
    // currently waiting on move
    this.practice.waitingOnMove = true;
    // disable the pgn links
    this.setPgnWithLinks(false);

    // if this is the 1st move in the line
    if (this.practice.moveIdx == 0) {
      // update the board status
      this.setStatus(BOARD_STATUS.animatingMoves);
      // set the orientation of the board
      var orient =
        this.practice.lineColor == "white" ? COLOR.white : COLOR.black;
      if (this.board.getOrientation() != orient) {
        this.board.setOrientation(orient);
      }

      // if we have moves to make to get to our position
      if (
        this.type == "analysis" ||
        this.practice.lines[this.practice.lineIdx].line.length > 0 ||
        this.practice.lines[this.practice.lineIdx].variation ||
        (this.practice.lines[this.practice.lineIdx].initialFen &&
          this.practice.lines[this.practice.lineIdx].initialFen != "")
      ) {
        // if we have moves to make to get to this line
        if (this.type == "analysis" || this.practice.animateToPosition) {
          //
          // -- resetToPosition - initialFen, check moves with current moves, return only the new moves,
          // -- reset first if all moves are new
          // -- returns array with new moves to be used for animating the moves
          //

          //
          // if same initial fen as current position = resetToPosition
          // if different, loadInitialFen = reset + make moves
          //

          // get the initial fen
          var initialFen = this.practice.lines[this.practice.lineIdx].initialFen
            ? this.practice.lines[this.practice.lineIdx].initialFen
            : "";
          // if the initial fen is different from the current
          if (initialFen != this.practice.initialFen) {
            // reset the game
            if (initialFen != "") {
              this.game.load(initialFen);
            } else {
              this.game.reset();
            }
            // update the board
            //this.board.setPosition(this.game.fen());
          }

          // start a new game with history & variations
          //this.newGame(initialFen, this.game.history({ verbose: true }));

          // reset to the new position
          var newMoves = this.resetToPosition(
            initialFen,
            this.practice.lines[this.practice.lineIdx].line
          );

          // if this line is a variation
          if (
            this.practice.lines[this.practice.lineIdx].variation &&
            this.type != "analysis"
          ) {
            // make the 1st move of the variation, that was the point we left off
            this.game.move(this.practice.lines[this.practice.lineIdx].move);

            newMoves.push(this.game.history({ verbose: true }).pop());
          }

          // reset to current game
          this.resetToCurrent(initialFen);

          // disable board move input
          //this.disableMoveInput();

          // animate to this position
          if (this.type == "analysis") {
            // if there are any moves
            //if (history.length > 0) {
            if (newMoves.length > 0) {
              // undo the last move
              var last = newMoves.pop();

              // update the board
              await this.board.setPosition(last.before, true);

              // pauseBoard
              // animate the last move
              await this.animateMoves([last]);
            }
          } else {
            //await this.animateMoves(history);
            await this.animateMoves(newMoves);
          }

          // enable board move input
          //this.enableMoveInput();
        } else if (this.practice.lines[this.practice.lineIdx].variation) {
          // make the 1st move of the variation, that was the point we left off
          this.game.move(this.practice.lines[this.practice.lineIdx].move);
          // get the last move
          var last = this.game.history({ verbose: true }).pop();

          // animate the move
          await this.board.movePiece(last.from, last.to, true);
          // update the board (in case of castling)
          this.board.setPosition(this.game.fen());
        }

        // if the practice was interrupted by a user action
        if (this.practice.stopAnimating) {
          this.practice.stopAnimating = false;

          return;
        }

        // if this is an analysis line
        if (this.type == "analysis") {
          // update the analysis game fields
          this.analysisFieldsUpdate();
        }
      } else if (colorChanged) {
        // reset the game & board
        this.game.reset();
        this.board.setPosition(this.game.fen());
      }
    }

    // remember the current move number
    this.practice.moveNr = this.game.history().length + 1;

    // if the user needs to make a move
    if (!this.isAutoMove()) {
      // if we have multiple moves
      if (moves.length > 1 || multiple.length > 1) {
        // update the status
        //if (moves.length < multiple.length) {
        if (playable.length < multiple.length) {
          this.showInfo(
            "You have " +
              (multiple.length - playable.length) +
              " more move" +
              (multiple.length - playable.length > 1 ? "s" : "") +
              " in your repertoire here."
          );
        } else {
          // update the status
          if (this.type == "analysis") {
            this.showInfo(
              "You played the move <b>" +
                this.practice.lines[this.practice.lineIdx].move +
                "</b>, which is " +
                (this.practice.lines[this.practice.lineIdx].type == "inaccuracy"
                  ? "an"
                  : "a") +
                " " +
                this.practice.lines[this.practice.lineIdx].type +
                ". There are " +
                moves.length +
                " good moves here."
            );
          } else {
            this.showInfo(
              "You have " + moves.length + " moves in your repertoire here."
            );
          }
        }

        // show the played moves container
        this.showPlayedMoves(multiple.length);

        // if we need to add moves to already played moves
        //if (moves.length < multiple.length) {
        if (playable.length < multiple.length) {
          for (var i = 0; i < multiple.length; i++) {
            if (!playable.includes(multiple[i].move)) {
              // add the move to the played moves list
              this.setPlayedMove(
                this.practice.lineMovesPlayed.length,
                multiple[i].move,
                multiple[i].cp,
                multiple[i].eline
              );
              this.practice.lineMovesPlayed.push(multiple[i].move);
            }
          }
        }
      } else {
        // update the status
        if (this.type == "analysis") {
          this.showInfo(
            "You played the move <b>" +
              this.practice.lines[this.practice.lineIdx].move +
              "</b>, which is " +
              (this.practice.lines[this.practice.lineIdx].type == "inaccuracy"
                ? "an"
                : "a") +
              " " +
              this.practice.lines[this.practice.lineIdx].type +
              ". Try to find the best move."
          );
          // show the played moves container
          this.showPlayedMoves(1);
        } else if (playable.length > 0) {
          this.showInfo("Play the move that's in your repertoire.");

          // hide the played moves
          this.hidePlayedMoves();
        }
      }
    }

    // remember the current FEN position
    this.practice.currentFen = this.game.fen();

    // wait on the next move
    this.waitOnMove();
  }

  // get the moves for a certain line/move
  getMoves() {
    var moves = [];

    var temp = this.practice.lines[this.practice.lineIdx];
    if (this.type != "analysis") {
      for (var i = 0; i < this.practice.moveIdx; i++) {
        temp = temp.moves[0];
      }
    }

    for (var i = 0; i < temp.moves.length; i++) {
      moves.push(temp.moves[i]["move"]);
    }

    // get the playable moves (not the autoplay moves)
    var playable = [];
    for (var i = 0; i < temp.moves.length; i++) {
      if (!temp.moves[i].autoplay) {
        playable.push(temp.moves[i].move);
      }
    }

    return [moves, temp.multiple, playable];
  }

  // wait on next move (use auto-play if needed)
  waitOnMove() {
    // if we need to auto-move
    if (this.isAutoMove()) {
      // auto-move (for other color)
      this.autoMove();
    } else {
      // update the board status
      this.setStatus(BOARD_STATUS.waitingOnMove);

      // add last move markers
      this.afterMakeMove();

      // if this is an analysis line
      if (this.type == "analysis") {
        // make the move that was played (the mistake)
        this.game.move(this.practice.lines[this.practice.lineIdx].move);
        // get the last move
        var last = this.game.history({ verbose: true }).pop();
        // undo the move
        this.game.undo();
        // mark the move that was played
        this.board.addMarker(this.markers.squareRed, last.from);
        this.board.addMarker(this.markers.squareRed, last.to);
      }
    }
  }

  // do we need to auto-move?
  isAutoMove() {
    return (
      (this.practice.lineColor == "white" && this.game.turn() == "b") ||
      (this.practice.lineColor == "black" && this.game.turn() == "w") ||
      (this.practice.lineMoves.length == 1 &&
        this.practice.lineMovesPlayable.length == 0)
    );
  }

  // auto-move
  async autoMove(next = false) {
    // if we have multiple moves or this is an analysis line
    if (this.practice.isMultiple || this.type == "analysis") {
      // goto the next line
      this.gotoNextLine();

      return;
    }

    if (next) {
      // goto the next move
      this.practice.moveIdx++;
    }

    // get the next moves
    var [moves, multiple, playable] = this.getMoves();

    // if any moves to play
    if (moves.length > 0) {
      // make the move
      this.game.move(moves[0]);
      // get the last move
      var last = this.game.history({ verbose: true }).pop();

      // animate the move
      await this.board.movePiece(last.from, last.to, true);
      // update the board (in case of castling)
      this.board.setPosition(this.game.fen());

      // if we have multiple moves from here
      if (moves.length > 1) {
        // goto the next line
        this.gotoNextLine(false);
      } else {
        // goto the next move
        this.gotoNextMove(false);
      }
    } else {
      // goto the next line
      this.gotoNextLine(true);
    }

    return;
  }

  // disables the board for a short time and then executes a function
  pauseBoard(func, ms = 800) {
    // disable the board
    //this.disableMoveInput();

    setTimeout(() => {
      // enable move input
      //this.enableMoveInput();

      // execute the function
      func();
    }, ms);
  }

  // called when the correct move was played
  correctMovePlayed() {
    var cp = null;
    var eline = null;

    for (var i = 0; i < this.practice.lineMovesMultiple.length; i++) {
      if (this.practice.lineMovesMultiple[i].move == this.lastMove.san) {
        cp = this.practice.lineMovesMultiple[i].cp;
        eline = this.practice.lineMovesMultiple[i].eline;
        break;
      }
    }

    // if we have multiple correct moves
    if (this.practice.isMultiple) {
      // if this move was already played
      if (this.practice.lineMovesPlayed.includes(this.lastMove.san)) {
        // update status
        this.showInfo(
          "You already played this move. Try to find the next move."
        );

        // pause the board for a moment
        this.pauseBoard(() => {
          // undo the last move
          //this.game.undo();
          //this.board.setPosition(this.game.fen());
          this.gameUndo();
          // remove markers
          this.board.removeMarkers();
        });

        return;
      }

      // add the move to the correctly played moves
      this.practice.lineMovesPlayed.push(this.lastMove.san);

      // show the played move in the list
      this.setPlayedMove(
        this.type == "analysis"
          ? this.practice.lineMoves.indexOf(this.lastMove.san)
          : this.practice.lineMovesPlayed.length - 1,
        this.lastMove.san,
        cp,
        eline
      );

      // update the move counter
      this.reduceMoveCount();

      // only add to the correct counter if we haven't failed the move
      if (
        this.practice.failedCount + this.practice.lineMovesPlayed.length <=
        this.practice.lineMoves.length
      ) {
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        {
          color: this.practice.lineColor,
          fen: this.lastMove.before,
          move: this.lastMove.san,
          correct: 1,
        },
      ]);

      // set the confirm message
      var nth = ["", "2nd ", "3rd "];
      var msg =
        this.type == "analysis"
          ? "That is the " +
            nth[this.practice.lineMoves.indexOf(this.lastMove.san)] +
            "best move."
          : "That's the correct move.";

      // if all correct moves have been played
      if (
        this.practice.lineMovesPlayed.length == this.practice.lineMoves.length
      ) {
        // update the status
        this.showConfirm(msg);

        //
        this.onMoveFinished();
      } else {
        // update the status
        this.showConfirm(msg + " Try to find the next move.");

        // pause the board for a moment
        this.pauseBoard(() => {
          // undo the last move
          //this.game.undo();
          //this.board.setPosition(this.game.fen());
          this.gameUndo();
          // remove markers
          this.board.removeMarkers();
          // wait on the next move
          this.waitOnMove();
        });
      }
    } else {
      // update the status
      this.showConfirm("That's the correct move.");

      // update the move counter
      this.reduceMoveCount();

      // if we have multiples here or this is an analysis line
      if (
        this.type == "analysis" ||
        this.practice.lineMovesMultiple.length > 1
      ) {
        // show the played move in the list
        this.setPlayedMove(
          this.practice.lineMovesPlayed.length,
          this.lastMove.san,
          cp,
          eline
        );
      }

      // if we didn't fail this move
      if (this.practice.failedCount == 0) {
        // update the correct counter
        this.addCorrectCount();
      }

      // update the counters for this move
      this.saveMoveCounters([
        {
          color: this.practice.lineColor,
          fen: this.lastMove.before,
          move: this.lastMove.san,
          correct: 1,
        },
      ]);

      this.onMoveFinished();
    }
  }

  // animate the moves 1 by 1
  async animateMoves(moves, lastOnly = false) {
    // reset stop animating boolean
    this.practice.stopAnimating = false;
    // animate the moves 1 by 1 (except for the last move)
    for (var i = 0; i < moves.length; i++) {
      // animate the move
      await this.board.movePiece(
        moves[i]["from"],
        moves[i]["to"],
        lastOnly ? i + 1 == moves.length : true
      );
      // if we need to stop animating
      if (this.practice.stopAnimating) {
        break;
      }
      // update the board (in case of castling)
      this.board.setPosition(moves[i].after);
    }
  }

  /**
   * Counters functions.
   * - showCounters
   * - hideCounters
   * - reduceMoveCount
   * - addCorrectCount
   * - addFailedCount
   * - saveMoveCounters
   */

  // show the counters
  showCounters(moveCount) {
    this.containers.counters.classList.remove("hidden");

    this.containers.moveCounter.innerHTML = moveCount;
    this.containers.correctCounter.innerHTML = 0;
    this.containers.failedCounter.innerHTML = 0;
  }

  // hide the counters
  hideCounters() {
    this.containers.counters.classList.add("hidden");
  }

  // reduce the move count
  reduceMoveCount(count = 1) {
    this.containers.moveCounter.innerHTML =
      parseInt(this.containers.moveCounter.innerHTML) - count;
  }

  // add to the correct count
  addCorrectCount() {
    this.containers.correctCounter.innerHTML =
      parseInt(this.containers.correctCounter.innerHTML) + 1;
  }

  // add to the failed count
  addFailedCount() {
    this.containers.failedCounter.innerHTML =
      parseInt(this.containers.failedCounter.innerHTML) + 1;
  }

  /**
   * Saves counters for 1 or multiple moves.
   *
   * moves: [{ fen: <fen>, move: <move>, [correct: 1 | failed: 1] }]
   *
   * @param {*} moves
   * @memberof Practice
   */
  saveMoveCounters(moves) {
    console.log("saveMoveCounters: " + this.type);
    console.log(moves);

    // not for analysis moves
    if (this.type == "analysis") {
      return false;
    }

    // we need to refresh the repertoire data when starting a new practice
    this.needsRefresh = true;

    // set the url
    var url = "api/repertoire/counters";

    var data = { moves: moves };

    // update the move counters
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
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  /**
   * Info containers functions.
   * - showInfo
   * - showConfirm
   * - showWarning
   * - hideStatus
   */

  // show an info message
  showInfo(status = "") {
    this.containers.confirm.classList.add("hidden");
    this.containers.warning.classList.add("hidden");
    this.containers.info.classList.remove("hidden");
    this.containers.info.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a confirmation message
  showConfirm(status = "") {
    this.containers.info.classList.add("hidden");
    this.containers.warning.classList.add("hidden");
    this.containers.confirm.classList.remove("hidden");
    this.containers.confirm.getElementsByTagName("span")[1].innerHTML = status;
  }

  // show a warning message
  showWarning(status = "") {
    this.containers.info.classList.add("hidden");
    this.containers.confirm.classList.add("hidden");
    this.containers.warning.classList.remove("hidden");
    this.containers.warning.getElementsByTagName("span")[1].innerHTML = status;
  }

  // hide the status messages
  hideStatus() {
    this.containers.info.classList.add("hidden");
    this.containers.confirm.classList.add("hidden");
    this.containers.warning.classList.add("hidden");
  }

  /**
   * Practice buttons functions.
   * - giveHint
   * - getPieceHint
   * - skipMove
   */

  // give a hint
  giveHint() {
    // if this is the 1st hint
    if (this.hintCounter == 0) {
      // get the hint and show it
      var hint = this.getPieceHint();
      this.showInfo(hint);
    } else {
      // get the moves that haven't been played yet
      var notPlayed = this.practice.lineMoves.filter((move) => {
        return this.practice.lineMovesPlayed.indexOf(move) < 0;
      });

      // get the coordinates
      var coords = [];
      for (var i = 0; i < notPlayed.length; i++) {
        if (this.game.move(notPlayed[i])) {
          var last = this.game.history({ verbose: true }).pop();
          coords.push(last);
          this.game.undo();
        }
      }

      // mark the move(s)
      this.board.removeMarkers();
      if (this.hintCounter == 1) {
        for (var i = 0; i < coords.length; i++) {
          this.board.addMarker(MARKER_TYPE.square, coords[i].from);
        }
      } else {
        for (var i = 0; i < coords.length; i++) {
          this.board.addMarker(MARKER_TYPE.square, coords[i].from);
          this.board.addMarker(MARKER_TYPE.square, coords[i].to);
        }
      }
    }

    // increase the hint counter
    this.hintCounter++;
  }

  // get a hint on which piece to move
  getPieceHint() {
    // the pieces
    var pieces = {
      p: "pawn",
      R: "rook",
      N: "knight",
      B: "bishop",
      Q: "queen",
      K: "king",
      O: "king",
      0: "king",
    };

    // get the not played moves
    var notPlayed = this.practice.lineMoves.filter((move) => {
      return this.practice.lineMovesPlayed.indexOf(move) < 0;
    });

    // if all moves have been played
    if (notPlayed.length == 0) {
      return "Hawk Tuah!";
    }

    // get the moves per piece
    var moves = [];
    var moveCnt = 0;
    for (var i = 0; i < notPlayed.length; i++) {
      var piece = pieces[notPlayed[i].charAt(0)]
        ? pieces[notPlayed[i].charAt(0)]
        : pieces["p"];

      if (moves[piece]) {
        moves[piece]++;
      } else {
        moves[piece] = 1;
        moveCnt++;
      }
    }

    // sort the moves, multiples first
    moves.sort();
    moves.reverse();

    // set the hint
    var hint = "";
    var idx = 0;
    for (var prop in moves) {
      if (hint == "") {
        if (moves[prop] == 1) {
          hint = "It's a " + prop + " move";
        } else {
          if (moves.length == 1) {
            if (moves[prop] == 2) {
              hint = "They are both " + prop + " moves";
            } else {
              hint = "They are all " + prop + " moves";
            }
          } else {
            hint = "There are " + moves[prop] + " " + prop + " moves";
          }
        }
      } else {
        if (idx + 1 == moveCnt) {
          hint += " and ";
        } else {
          hint += ", ";
        }
        if (moves[prop] == 1) {
          hint += "a " + prop + " move";
        } else {
          hint += moves[prop] + " " + prop + " moves";
        }
      }

      idx++;
    }

    hint += ".";

    return hint;
  }

  // skip the current move
  async skipMove() {
    // if practice was paused
    if (this.practice.paused) {
      // continue practice
      this.continuePractice();

      return;
    }

    if (
      this.practice.current_lineIdx != this.practice.lineIdx ||
      this.practice.current_moveIdx != this.practice.moveIdx
    ) {
      console.log(
        "*************** REDUCE MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE MOVE COUNT ERROR ********************"
      );
    }

    if (
      this.practice.skipped_lineIdx == this.practice.lineIdx &&
      this.practice.skipped_moveIdx == this.practice.moveIdx
    ) {
      console.log(
        "*************** REDUCE SKIPPED MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE SKIPPED MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE SKIPPED MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE SKIPPED MOVE COUNT ERROR ********************"
      );
      console.log(
        "*************** REDUCE SKIPPED MOVE COUNT ERROR ********************"
      );
    }

    // update the move counter
    this.reduceMoveCount(
      this.practice.lineMoves.length - this.practice.lineMovesPlayed.length
    );

    // if we have multiple moves from here or this is an analysis
    if (this.practice.isMultiple) {
      // goto the next line
      this.gotoNextLine(true);
    } else {
      // get the next moves
      var [moves, multiple, playable] = this.getMoves();

      // if we have a move to play (with a move after that)
      if (
        moves.length > 0 &&
        moves[0].moves &&
        moves[0].moves.length > 0 &&
        this.type != "analysis"
      ) {
        // make the move
        this.game.move(moves[0]);
        // get the last move
        var last = this.game.history({ verbose: true }).pop();

        // animate the move
        await this.board.movePiece(last.from, last.to, true);
        // update the board (in case of castling)
        this.board.setPosition(this.game.fen());

        // goto the next move
        this.gotoNextMove(false);
      } else {
        // goto the next line
        this.gotoNextLine(true);
      }
    }
  }

  /**
   * Played moves container functions.
   * - showPlayedMoves
   * - hidePlayedMoves
   * - setPlayedMove
   */

  // show the played moves container
  showPlayedMoves(count) {
    // clear the moves list
    while (this.playedMovesList.lastChild) {
      this.playedMovesList.removeChild(this.playedMovesList.firstChild);
    }

    // add the rows for the moves
    for (var i = 0; i < count; i++) {
      var row = document.createElement("div");
      row.className =
        "flex justify-between items-center px-2 py-3" +
        (i + 1 == count
          ? ""
          : " border-b border-slate-200 dark:border-slate-800");

      var cell = document.createElement("div");
      cell.className = "text-base dark:text-gray-200";
      cell.innerHTML = Math.ceil(this.practice.moveNr / 2) + ". _";

      row.appendChild(cell);

      cell = document.createElement("div");
      cell.className =
        "hidden cursor-pointer px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-primary-50 hover:dark:bg-black/10 rounded-full border border-transparent hover:border-primary-100 hover:dark:border-black/10";
      cell.innerHTML = "";

      row.appendChild(cell);

      this.playedMovesList.appendChild(row);
    }

    // set the label
    this.playedMovesContainer.children[0].innerHTML =
      count > 1 ? "Moves" : "Move";

    // show the moves list
    this.playedMovesContainer.classList.remove("hidden");
  }

  // hide the played moves container
  hidePlayedMoves() {
    this.playedMovesContainer.classList.add("hidden");
  }

  // add a move to the played moves container
  setPlayedMove(index, move, cp = null, line = []) {
    console.log("setPlayedMove: " + index);
    console.log(move, cp, line);

    // set the CP eval
    var cpEval = cp
      ? '&nbsp;<sup class="text-xs text-gray-600 dark:text-gray-400">' +
        (cp >= 0 ? "+" : "") +
        Math.round(cp) / 100 +
        "</sup>"
      : "";
    // set the move
    this.playedMovesList.children[index].children[0].innerHTML =
      Math.ceil(this.practice.moveNr / 2) + ". " + move + cpEval;

    // add the show line link
    if (line && line.length > 0) {
      this.playedMovesList.children[index].children[1].innerHTML = "show line";
      this.playedMovesList.children[index].children[1].classList.remove(
        "hidden"
      );

      // add the click handler
      this.playedMovesList.children[index].children[1].addEventListener(
        "click",
        (event) => {
          // add the variation
          var variation = this.addVariation(this.practice.moveNr, line);
          // update the pgn field
          this.updatePgnField();
          // if the practice is paused
          if (this.practice.paused) {
            // goto the move
            this.gotoMove(this.practice.moveNr, variation);
          }
        }
      );
    }
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var practice = new Practice();
});
