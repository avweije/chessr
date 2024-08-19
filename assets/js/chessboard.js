//import { Chess } from "chess.js/dist/esm/chess.js";
import { MyChess } from "./chess.js";
import { Chessboard, FEN } from "cm-chessboard/src/Chessboard.js";
import {
  COLOR,
  INPUT_EVENT_TYPE,
} from "cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "cm-chessboard/src/extensions/markers/Markers.js";
import { PromotionDialog } from "cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js";

import "../styles/chessboard.css";
import "cm-chessboard/assets/extensions/promotion-dialog/promotion-dialog.css";

export const BOARD_STATUS = {
  default: "default",
  waitingOnMove: "waitingOnMove",
  animatingMoves: "animatingMoves",
};

export const BOARD_SETTINGS = {
  variations: "useVariations",
  premoves: "premoveEnabled",
  navigation: "navigationEnabled",
  pgn: {
    links: "pgn.withLinks",
    styling: {
      main: {
        default: "pgn.styling.main",
        text: "pgn.styling.mainText",
        link: "pgn.styling.mainLink",
      },
    },
  },
};

/*
MyChessBoard Class - Integrates Chess.js with cm-chessboard, validates moves, adds markers, etc.
*/
export class MyChessBoard {
  board = null;
  game = null;

  status = BOARD_STATUS.default;
  premove = null;

  settings = {
    useVariations: true,
    premoveEnabled: false,
    navigationEnabled: false, // enable prev/next by using left/right arrow keys
    pgn: {
      withLinks: true,
      styling: {
        main: "inline-block px-0.5 text-base rounded",
        mainText: "text-gray-800 dark:text-gray-200 border border-transparent",
        mainLink:
          "cursor-pointer border border-transparent text-gray-800 dark:text-gray-200 hover:text-gray-600 hover:bg-slate-100 hover:border-slate-300 dark:hover:text-gray-200 dark:hover:bg-slate-500 dark:hover:border-slate-600",
        variation: "inline-block px-0.5 italic text-sm rounded",
        variationText:
          "text-gray-600 dark:text-gray-300 border border-transparent",
        variationLink:
          "cursor-pointer border border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-600 hover:bg-slate-100 hover:border hover:border-slate-300 dark:hover:text-gray-300 dark:hover:bg-slate-500 dark:hover:border-slate-600",
        currentMove:
          "border text-primary-500 dark:text-primary-300 bg-primary-50 border-slate-300 dark:bg-slate-500 dark:border-slate-600",
      },
    },
  };

  pgnField = null;

  initialFen = "";
  currentMove = -1;
  currentVariation = -1;

  history = [];
  variations = [];

  /*

  - keep track of complete history with variations
  - option to move back and forward through game

  - keep track of main line (user can just make moves playing around)
  - main line should be kept in tact
  - and you should be able to have a getMoves / history function for the main line ??

  - options: 
  - + useVariations = on new move, add variation or overwrite existing line
  - + keepMainLine = ? see above, probably the same setting?

  - newGame()
  - reset(?fen)
  - load(fen)
  - goBack(), goForward(), goFirst(), goLast()
  - makeMoves(moves)
  - jumpToMove(moveNr, variationNr)
  - getVariations()
  - getMainLine() ?

  - getPgn(withVariations = true)
  - getPgnLinks(withVariations = true)

  - currentFen()
  - currentLine() ?
  - currentVariation() ?

  */

  // the custom markers
  markers = {
    checkmark: {
      class: "marker-checkmark",
      slice: "markerCheckmark",
    },
    cancel: {
      class: "marker-cancel",
      slice: "markerCancel",
    },
    squareGreen: {
      class: "marker-square-green",
      slice: "markerSquare",
    },
    squareRed: {
      class: "marker-square-red",
      slice: "markerSquare",
    },
  };

  constructor() {
    // create the chess game
    this.game = new MyChess();

    // add keydown event listeners for left/right (prev/next move)
    document.addEventListener("keydown", (event) => {
      // if navigation is enabled and arrow left/right was hit
      if (
        this.settings.navigationEnabled &&
        (event.key == "ArrowRight" || event.key == "ArrowLeft") &&
        (!document.activeElement ||
          !["INPUT", "SELECT", "TEXTAREA"].includes(
            document.activeElement.nodeName
          ))
      ) {
        if (event.key == "ArrowRight") {
          this.gotoNext();
        } else {
          this.gotoPrevious();
        }
      }
    });
  }

  /*
  Initialise the chessboard.

  @params:
  - boardElement: the container element for displaying the chessboard
  - color: the initial orientation of the chessboard.
  */

  init(boardElement, color = COLOR.white, settings = {}) {
    // create the chess board
    this.board = new Chessboard(boardElement, {
      position: FEN.start,
      orientation: color,
      assetsUrl: "/build/", // wherever you copied the assets folder to, could also be in the node_modules folder
      style: {
        cssClass: "chess-club", // set the css theme of the board, try "green", "blue" or "chess-club"
        showCoordinates: true, // show ranks and files
        aspectRatio: 1, // height/width of the board
        animationDuration: 300, // pieces animation duration in milliseconds. Disable all animations with `0`
      },
      extensions: [
        {
          class: Markers,
          props: { sprite: "/build/extensions/markers/markers.svg" },
        },
        {
          class: PromotionDialog,
        },
      ],
    });

    // apply the settings
    this.settings = this.deepMerge(this.settings, settings);
  }

  setOption(setting, value) {
    try {
      // get the (nested) setting keys
      var parts = setting.split(".");
      var temp = this.settings;
      for (var i = 1; i < parts.length; i++) {
        temp = temp[parts[i - 1]];
      }
      // update the setting
      temp[parts[parts.length - 1]] = value;
    } catch (err) {
      console.error(err);
    }
  }

  deepMerge(obj1, obj2) {
    for (let key in obj2) {
      if (obj2.hasOwnProperty(key)) {
        if (obj2[key] instanceof Object && obj1[key] instanceof Object) {
          obj1[key] = this.deepMerge(obj1[key], obj2[key]);
        } else {
          obj1[key] = obj2[key];
        }
      }
    }
    return obj1;
  }

  /*
  Public functions.
  */

  // enable move input
  enableMoveInput() {
    try {
      this.board.enableMoveInput(this.moveInputHandler.bind(this));
    } catch (err) {
      console.log(err);
    }
  }

  // disable move input
  disableMoveInput() {
    try {
      this.board.disableMoveInput();
    } catch (err) {
      console.log(err);
    }
  }

  // get the correct FEN notation (en passant rule not included if not actually possible, should always be included if pawn moved 2 squares)
  getFen() {
    // the en passant notation
    var enPassant = "-";
    // get the last move
    var last = this.game.history({ verbose: true }).pop();
    // if the last move was a pawn move
    if (last && last.piece == "p") {
      // if the pawn moved 2 squares
      if (last.from.charAt(1) == "2" && last.to.charAt(1) == "4") {
        enPassant = last.from.charAt(0) + "3";
      } else if (last.from.charAt(1) == "7" && last.to.charAt(1) == "5") {
        enPassant = last.from.charAt(0) + "6";
      }
    }

    // split the game FEN
    var fenParts = this.game.fen().split(" ");
    // override the en passant part
    fenParts[3] = enPassant;

    return fenParts.join(" ");
  }

  //
  resetToPosition(initialFen, moves, updateBoard = true) {
    // get the current moves
    var history = this.game.history({ verbose: true });
    var movesToMake = [];

    var match = initialFen == this.initialFen && moves.length >= history.length;

    // see if the current moves match the new moves
    for (var i = 0; i < moves.length; i++) {
      // if this is a new move
      if (i >= history.length) {
        movesToMake.push(moves[i]);
      } else if (moves[i] !== history[i].san) {
        // not a match, stop checking
        match = false;
        break;
      }
    }

    // reset the game & board
    if (!match) {
      // if we have an initial fen
      if (initialFen != "") {
        this.game.load(initialFen);
      } else {
        this.game.reset();
      }
      // update the board
      if (updateBoard) {
        this.board.setPosition(this.game.fen());
      }

      movesToMake = moves;
    }

    // the new moves
    var newMoves = [];
    // make the (new) moves
    for (var i = moves.length - movesToMake.length; i < moves.length; i++) {
      this.game.move(moves[i]);
      newMoves.push(this.game.history({ verbose: true }).pop());
    }

    return newMoves;
  }

  // make a move
  makeMove(move) {
    try {
      // make the move
      this.game.move(move);
      // set the new position
      this.board.setPosition(this.game.fen());

      // add the move to our history with variations
      this.addMoveToHistory(this.game.history({ verbose: true }).pop());

      // process the move
      this.afterMakeMove();
      // call the after move event
      this.afterMove(move);
    } catch (err) {
      console.log(err);
    }
  }

  // jump to a certain position
  jumpToMove(index) {
    try {
      // get the history of moves
      var moves = this.game.history({ verbose: true });

      // undo the last X moves
      for (var i = 1; i < moves.length - index; i++) {
        this.game.undo();
      }

      /*
      // reset the game and make the moves
      this.game.reset();
      for (var i = 0; i <= index; i++) {
        this.game.move(moves[i].san);
      }
        */

      // set the board position
      this.board.setPosition(this.game.fen());

      // process the move
      this.afterMakeMove();
      // call the after move event
      this.afterMove(moves[index]);
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * history + variations
   */

  newGame(fen = "", moves = []) {
    this.initialFen = fen;
    this.game.reset();

    if (fen != "") {
      this.game.load(fen);
    }
    this.board.setPosition(this.game.fen());

    this.history = moves;
    this.variations = [];
    this.currentMove = -1;
    this.currentVariation = -1;

    // update the pgn field
    this.updatePgnField();
  }

  resetToCurrent(fen = "") {
    this.initialFen = fen;
    this.history = this.game.history({ verbose: true });
    this.variations = [];
    this.currentMove = this.history.length;
    this.currentVariation = -1;
    // update the pgn field
    this.updatePgnField();
  }

  gameMove(move) {
    this.game.move(move);
    this.addMoveToHistory(move);
  }

  gameUndo() {
    // undo the move
    this.game.undo();
    // update the board
    this.board.setPosition(this.game.fen());
    // remove from history or variation
    if (this.currentVariation == -1) {
      this.history.pop();
    } else {
      this.variations[this.currentVariation].moves.pop();
      if (this.variations[this.currentVariation].moves.length == 0) {
        this.variations.splice(this.currentVariation, 1);
        this.currentVariation = -1;
      }
    }
    // update the current move
    this.currentMove = this.game.history().length;
    // update the pgn field
    this.updatePgnField();
  }

  isFirst() {
    // make sure we have the currentMove
    this.currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    return this.currentMove == 1;
  }

  isLast() {
    // make sure we have the currentMove
    this.currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    // make sure the current variation is valid
    if (
      this.currentVariation >= 0 &&
      this.currentVariation >= this.variations.length
    ) {
      this.currentVariation = -1;
    }

    if (this.currentVariation >= 0) {
      if (this.variations[this.currentVariation].moveNr < this.history.length) {
        return false;
      }

      return (
        this.currentMove ==
        this.variations[this.currentVariation].moveNr +
          this.variations[this.currentVariation].moves.length -
          1
      );
    } else {
      return this.currentMove == this.history.length;
    }
  }

  gotoMove(moveNr, variationIdx = -1) {
    var moves = [];

    // safety, 1st move minimum
    moveNr = Math.max(1, moveNr);
    // make sure the variation index is correct
    if (variationIdx >= 0) {
      // if the variation does not exist
      if (variationIdx >= this.variations.length) {
        return false;
      }

      // if the move lies after the variation
      if (
        moveNr >
        this.variations[variationIdx].moveNr +
          this.variations[variationIdx].moves.length
      ) {
        return false;
      }

      // if the move lies before the variation, goto the parent variation
      while (
        variationIdx >= 0 &&
        moveNr < this.variations[variationIdx].moveNr
      ) {
        variationIdx =
          this.variations[variationIdx].parent == null
            ? -1
            : this.variations[variationIdx].parent;
      }
    }

    // safety, last move maximum
    if (variationIdx >= 0) {
      moveNr = Math.min(
        moveNr,
        this.variations[variationIdx].moveNr -
          1 +
          this.variations[variationIdx].moves.length
      );
    } else {
      moveNr = Math.min(moveNr, this.history.length);
    }

    // safety, in case no moves
    if (moveNr == 0) {
      return false;
    }

    // remember the current move & variation
    this.currentMove = moveNr;
    this.currentVariation = variationIdx;

    // if this is a main line move
    if (variationIdx == -1) {
      // get the moves
      moves = this.history.slice(0, moveNr);
    } else {
      // get the 1st move of the top (parent) variation
      var varStart = this.variations[variationIdx].moveNr;
      // get all the parent-variations, top level 1st
      var parent = this.variations[variationIdx].parent;
      var parents = [];
      while (parent !== null) {
        // add to the beginning of the parents array
        parents.splice(0, 0, parent);

        varStart = this.variations[parent].moveNr;
        parent = this.variations[parent].parent;
      }

      // get the main line moves
      moves = this.history.slice(0, varStart - 1);

      // add the parent(s) variation moves
      for (var i = 0; i < parents.length; i++) {
        var varEnd =
          parents.length > i + 1
            ? this.variations[parents[i + 1]].moveNr
            : this.variations[variationIdx].moveNr;

        moves = moves.concat(
          this.variations[parents[i]].moves.slice(
            0,
            varEnd - this.variations[parents[i]].moveNr
          )
        );
      }

      // add the variation moves
      moves = moves.concat(
        this.variations[variationIdx].moves.slice(
          0,
          moveNr - this.variations[variationIdx].moveNr + 1
        )
      );
    }

    // reset to position (need to use diff function for this later..)
    this.resetToPosition(this.initialFen, moves, false);
    // update the board
    this.board.setPosition(this.game.fen());
    // process the move
    this.afterMakeMove();
    // update the PGN field
    this.updatePgnField();

    // call the afterGotoMove handler
    this.afterGotoMove(moveNr, variationIdx);

    return true;
  }

  // goto 1st move main line
  gotoFirst() {
    this.gotoMove(1);
  }

  // goto last move main line
  gotoLast() {
    this.gotoMove(this.history.length);
  }

  // goto previous move in current line or variation
  gotoPrevious() {
    // make sure we have the currentMove
    this.currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    var gotoMove = this.currentMove - 1;

    // if we are on the 1st move of a variation
    if (
      this.currentVariation >= 0 &&
      this.currentVariation < this.variations.length &&
      this.currentMove == this.variations[this.currentVariation].moveNr
    ) {
      gotoMove = gotoMove + 1;
    }

    this.gotoMove(gotoMove, this.currentVariation);
  }

  // goto next move in current line or variation
  gotoNext() {
    // make sure we have the currentMove
    this.currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    this.gotoMove(this.currentMove + 1, this.currentVariation);
  }

  //
  addMoveToHistory(move) {
    try {
      // get the current move index
      //var moveNr = this.game.moveNumber();
      var moveNr = this.game.history().length;

      // if we are in the main line
      if (this.currentVariation == -1) {
        // if this is a new move
        if (this.history.length < moveNr) {
          // add the move to the main line
          this.history.push(move);
        } else {
          //

          if (this.settings.useVariations) {
            //
            var addVariation = true;
            //
            for (var i = 0; i < this.variations.length; i++) {
              if (this.variations[i].moveNr == moveNr) {
                //
                if (this.variations[i].moves[0].san == move.san) {
                  // set the current variation
                  this.currentVariation = this.variations.length - 1;

                  addVariation = false;
                  break;
                }
              }
            }

            //
            if (addVariation) {
              // add a new main line variation
              this.variations.push({
                moveNr: moveNr,
                parent: null,
                moves: [move],
              });

              // set the current variation
              this.currentVariation = this.variations.length - 1;
            }
          } else {
            // overwrite the main line and add the new move
            this.history.splice(0, moveNr, move);
          }
        }
      } else {
        // if this is a new move for the variation
        if (
          this.variations[this.currentVariation].moveNr -
            1 +
            this.variations[this.currentVariation].moves.length <
          moveNr
        ) {
          // add the move to the current variation
          this.variations[this.currentVariation].moves.push(move);
        } else {
          //
          // check if the move matches the variation move
          // if not, add new variation
          //

          // if this is a different move
          if (
            this.variations[this.currentVariation].moves[
              moveNr - this.variations[this.currentVariation].moveNr
            ].san != move.san
          ) {
            // add a new sub-variation
            this.variations.push({
              moveNr: moveNr,
              parent: this.currentVariation,
              moves: [move],
            });

            // set the current variation
            this.currentVariation = this.variations.length - 1;
          }
        }
      }

      //
      this.currentMove = moveNr;

      // update the pgn field
      this.updatePgnField();
    } catch (err) {
      console.log(err);
    }
  }

  addVariation(moveNr, moves) {
    var newMoves = [];
    var moveVar = -1;
    var currVar = -1;
    var match = true;
    // loop through the moves
    for (var i = 0; i < moves.length; i++) {
      var ii = moveNr - 1 + i;
      // if no more history or (current) variation moves
      if (
        !match ||
        (currVar == -1 && this.history.length <= ii) ||
        (currVar >= 0 &&
          this.variations[currVar].moveNr -
            1 +
            this.variations[currVar].moves.length <=
            ii)
      ) {
        // add the move as a new move
        newMoves.push(moves[i]);

        continue;
      }

      // if the history move does not match
      if (currVar == -1 && this.history[ii].san !== moves[i]) {
        // not a match, check main line variations
        for (var x = 0; x < this.variations.length; x++) {
          if (
            this.variations[x].parent == null &&
            this.variations[x].moveNr == ii + 1 &&
            this.variations[x].moves[0].san == moves[i]
          ) {
            // move found in main line variation
            currVar = x;

            // if this is the 1st move
            if (i == 0) {
              moveVar = x;
            }

            break;
          }
        }

        // no match if move wasn't found in a main line variation
        match = currVar >= 0;
      }

      // if the variation move does not match
      if (
        currVar >= 0 &&
        this.variations[currVar].moves[ii - this.variations[currVar].moveNr + 1]
          .san !== moves[i]
      ) {
        var found = false;
        // not a match, check child variations
        for (var x = 0; x < this.variations.length; x++) {
          if (
            this.variations[x].parent == this.variations[currVar].parent &&
            this.variations[x].moveNr == ii + 1 &&
            this.variations[x].moves[0].san == moves[i]
          ) {
            // move found in child variation
            currVar = x;
            found = true;

            break;
          }
        }

        // no match if move wasn't found
        match = found;
      }

      // if no match
      if (!match) {
        // add the move as a new move
        newMoves.push(moves[i]);
      }
    }

    // if (part of) the variation is new
    if (newMoves.length > 0) {
      // create a game to make the moves
      var game = new MyChess();
      if (this.initialFen != "") {
        game.load(this.initialFen);
      }

      var upTo = moveNr - 1 + moves.length - newMoves.length;

      // make the moves up to the new moves
      for (var i = 0; i < upTo; i++) {
        game.move(this.history[i].san);
      }

      // make the moves & get them
      var madeMoves = [];
      for (var i = 0; i < newMoves.length; i++) {
        // make the move
        game.move(newMoves[i]);
        // add it to our history
        madeMoves.push(game.history({ verbose: true }).pop());
      }

      // if these are main line moves
      if (currVar == -1 && match) {
        // add the main line moves
        for (var i = 0; i < madeMoves.length; i++) {
          // add it to our history
          this.history.push(madeMoves[i]);
        }
      } else {
        // add a variation
        this.variations.push({
          moveNr: moveNr + moves.length - newMoves.length,
          parent: currVar == -1 ? null : currVar,
          moves: madeMoves,
        });

        if (newMoves.length == moves.length) {
          moveVar = this.variations.length - 1;
        }
      }
    }

    return moveVar;
  }

  setPgnField(element) {
    this.pgnField = element;
  }

  setPgnWithLinks(toggle = true) {
    this.settings.pgn.withLinks = toggle;
    // update the pgn field
    this.updatePgnField();
  }

  updatePgnField() {
    if (this.pgnField) {
      this.getPgn(this.settings.useVariations, this.pgnField);
    }
  }

  getPgnWithLinks(withVariations = true) {
    return this.getPgn(withVariations, true);
  }

  getPgn(withVariations = true, pgnField = null) {
    var pgn = "";

    if (pgnField) {
      //pgnField.innerHTML = this.history.length == 0 ? "&nbsp;" : "";
      pgnField.innerHTML = "";

      if (this.history.length == 0) {
        var sp = document.createElement("span");
        sp.className =
          this.settings.pgn.styling.main +
          " " +
          this.settings.pgn.styling.mainText;
        sp.innerHTML = "1.";

        pgnField.appendChild(sp);
      }
    }

    var currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    for (var i = 0; i < this.history.length; i++) {
      var moveNr = Math.floor(i / 2) + 1;

      if (i % 2 == 0) {
        pgn += moveNr + ". ";

        if (pgnField) {
          var sp = document.createElement("span");
          sp.className =
            this.settings.pgn.styling.main +
            " " +
            this.settings.pgn.styling.mainText;
          sp.innerHTML = moveNr + ".";

          pgnField.appendChild(sp);
        }
      }

      pgn += this.history[i].san + " ";

      if (pgnField) {
        var sp = document.createElement("span");
        sp.className = this.settings.pgn.styling.main + " ";

        // if this is the current move
        if (this.currentVariation == -1 && currentMove == i + 1) {
          sp.className = sp.className + this.settings.pgn.styling.currentMove;
        } else if (this.settings.pgn.withLinks) {
          sp.className = sp.className + this.settings.pgn.styling.mainLink;
        } else {
          sp.className = sp.className + this.settings.pgn.styling.mainText;
        }

        sp.innerHTML = this.history[i].san;
        sp.setAttribute("data-move", i + 1);

        // add event listener
        if (this.settings.pgn.withLinks) {
          sp.addEventListener("click", (event) => {
            // goto a certain move
            this.gotoMove(event.target.getAttribute("data-move"));
          });
        }

        pgnField.appendChild(sp);
      }

      if (this.settings.useVariations && withVariations) {
        for (var x = 0; x < this.variations.length; x++) {
          if (
            this.variations[x].parent == null &&
            this.variations[x].moveNr == i + 1
          ) {
            pgn += this.getPgnForVariation(i, x, pgnField);
          }
        }
      }
    }

    return pgn.trim();
  }

  getPgnForVariation(i, x, pgnField) {
    var pgn = '<span style="color: #707070; style: italic;">(';

    if (pgnField) {
      var sp = document.createElement("span");
      sp.className =
        this.settings.pgn.styling.variation +
        " " +
        this.settings.pgn.styling.variationText;

      sp.innerHTML = "(";

      pgnField.appendChild(sp);
    }

    var moveNr = Math.floor(i / 2) + 1;

    if (i % 2 == 1) {
      pgn += moveNr + "... ";

      if (pgnField) {
        var sp = document.createElement("span");
        sp.className =
          this.settings.pgn.styling.variation +
          " " +
          this.settings.pgn.styling.variationText;
        sp.innerHTML = moveNr + "...";
        pgnField.appendChild(sp);
      }
    }

    for (var y = 0; y < this.variations[x].moves.length; y++) {
      // get the move number
      moveNr = Math.floor((i + y) / 2) + 1;

      if ((i + y) % 2 == 0) {
        pgn += moveNr + ". ";

        if (pgnField) {
          var sp = document.createElement("span");
          sp.className =
            this.settings.pgn.styling.variation +
            " " +
            this.settings.pgn.styling.variationText;
          sp.innerHTML = moveNr + ".";
          pgnField.appendChild(sp);
        }
      }
      pgn += this.variations[x].moves[y].san + " ";

      if (pgnField) {
        var sp = document.createElement("span");
        sp.className = this.settings.pgn.styling.variation + " ";

        // if this is the current move
        if (this.currentVariation == x && this.currentMove == i + y + 1) {
          sp.className = sp.className + this.settings.pgn.styling.currentMove;
        } else if (this.settings.pgn.withLinks) {
          sp.className = sp.className + this.settings.pgn.styling.variationLink;
        } else {
          sp.className = sp.className + this.settings.pgn.styling.variationText;
        }

        sp.innerHTML = this.variations[x].moves[y].san;
        sp.setAttribute("data-variation", x);
        sp.setAttribute("data-move", i + y + 1);

        // add event listener
        if (this.settings.pgn.withLinks) {
          sp.addEventListener("click", (event) => {
            // goto a certain move
            this.gotoMove(
              event.target.getAttribute("data-move"),
              event.target.getAttribute("data-variation")
            );
          });
        }

        pgnField.appendChild(sp);
      }

      // look for any sub-variations from this point
      for (var z = 0; z < this.variations.length; z++) {
        if (
          this.variations[z].parent == x &&
          this.variations[z].moveNr == i + y + 1
        ) {
          pgn += this.getPgnForVariation(i + y, z, pgnField);
        }
      }
    }
    pgn += ")</span>";

    if (pgnField) {
      var sp = document.createElement("span");
      sp.className =
        this.settings.pgn.styling.variation +
        " " +
        this.settings.pgn.styling.variationText;

      sp.innerHTML = ")";

      pgnField.appendChild(sp);
    }

    return pgn;
  }

  getHistoryMove(moveNr) {
    var moves = [];

    // add the main line move
    if (this.history.length >= moveNr) {
      moves.push(this.history[moveNr]);
    }

    // add the variations moves
    for (var i = 0; i < this.variations.length; í++) {
      if (
        this.variations[i].moveNr <= moveNr &&
        this.variations[i].moveNr + this.variations[i].moves.length >= moveNr
      ) {
        moves.push(
          this.variations[i].moves[moveNr - this.variations[i].moveNr]
        );
      }
    }

    return moves;
  }

  //
  setStatus(status) {
    this.status = status;

    // if we need to make a premove
    if (this.status == BOARD_STATUS.waitingOnMove && this.premove !== null) {
      // make the move
      this.makeMove({
        from: this.premove.squareFrom,
        to: this.premove.squareTo,
        promotion: this.premove.promotion ? this.premove.promotion : "q",
      });

      this.premove = null;

      return true;
    }
  }

  /*
  Public event handlers, override in extended class.
  - onValidateMove: called when a legal move is being made, return false to cancel the move
  - afterMove: called after a legal move was made
  - afterIllegalMove: called after an illegal move was made
  - afterGotoMove: called after one of these functions is called: gotoFirst, gotoLast, gotoNext, gotoPrevious, gotoMove
  */
  onValidateMove(move) {
    return true;
  }

  afterMove(move) {}

  afterIllegalMove(move) {}

  afterGotoMove(moveNr, variationIdx) {}

  /*
  Private event handlers.
   */

  moveInputHandler(event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted:
        return this.moveInputStarted(event);
      case INPUT_EVENT_TYPE.validateMoveInput:
        return this.validateMoveInput(event);
      case INPUT_EVENT_TYPE.moveInputCanceled:
        this.moveInputCancelled(event);
        break;
      case INPUT_EVENT_TYPE.moveInputFinished:
        this.moveInputFinished(event);
        break;
      case INPUT_EVENT_TYPE.movingOverSquare:
        break;
    }
  }

  moveInputStarted(event) {
    // do not pick up pieces if the game is over
    if (this.game.isGameOver()) return false;

    // if this is a premove
    if (this.status !== BOARD_STATUS.waitingOnMove) {
      // add a marker
      this.board.addMarker(this.markers.squareRed, event.squareFrom);

      return true;
    }

    var piece = this.board.getPiece(event.squareFrom);

    // only pick up pieces for the side to move
    if (
      (this.game.turn() === "w" && piece.search(/^b/) !== -1) ||
      (this.game.turn() === "b" && piece.search(/^w/) !== -1)
    ) {
      return false;
    }

    var moves = [];
    for (const move of this.game.moves({ square: event.squareFrom })) {
      // remove the piece notation and other characters to just get the square
      var t = move
        .replace(/^[RNBKQ]x?/, "")
        .replace("!", "")
        .replace("#", "");

      moves.push({ from: event.squareFrom, to: t });
    }

    // show the legal moves
    this.board.addLegalMovesMarkers(moves);

    return true;
  }

  validateMoveInput(event) {
    try {
      // if this is a promotion
      if (
        ((this.game.turn() === "b" && event.squareTo.charAt(1) === "1") ||
          (this.game.turn() === "w" && event.squareTo.charAt(1) === "8")) &&
        event.piece.charAt(1) === "p"
      ) {
        // show the promotion dialog
        this.board.showPromotionDialog(
          event.squareTo,
          this.game.turn() === "w" ? COLOR.white : COLOR.black,
          (result) => {
            if (result && result.piece) {
              // if this is a premove
              if (this.status !== BOARD_STATUS.waitingOnMove) {
                this.premove = event;
                this.premove.promotion = result.piece.charAt(1);

                // remember the premove (only 1 premove allowed, check if there already was one.. etc)
                this.board.addMarker(this.markers.squareRed, event.squareFrom);
                this.board.addMarker(this.markers.squareRed, event.squareTo);
              } else {
                //chessboard.setPiece(result.square, result.piece, true);
                // make the move
                this.makeMove({
                  from: event.squareFrom,
                  to: event.squareTo,
                  promotion: result.piece.charAt(1),
                });
              }
            } else {
              //chessboard.setPosition(position);
            }
          }
        );

        // return false here, cancelling the move, on dialog result, we make the move.. if not, move is already cancelled
        return false;
      }

      // if this is a premove
      if (this.status !== BOARD_STATUS.waitingOnMove) {
        this.premove = event;

        // remember the premove (only 1 premove allowed, check if there already was one.. etc)
        this.board.addMarker(this.markers.squareRed, event.squareFrom);
        this.board.addMarker(this.markers.squareRed, event.squareTo);

        return false;
      }

      // see if the move is legal
      var move = this.game.move({
        from: event.squareFrom,
        to: event.squareTo,
        promotion: "q", // NOTE: always promote to a queen for example simplicity
      });

      if (this.onValidateMove(move)) {
        // set the board position
        this.board.setPosition(this.game.fen());

        // add the move to our history with variations
        this.addMoveToHistory(this.game.history({ verbose: true }).pop());

        return true;
      } else {
        // undo the move
        this.game.undo();

        return false;
      }
    } catch (err) {
      console.log(err);

      return false;
    }
  }

  moveInputCancelled(event) {
    console.log("moveInputCancelled:");
    console.log(event);
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();
  }

  moveInputFinished(event) {
    console.log("moveInputFinished:");
    console.log(event);
    // if this was an actual move
    if (event.squareFrom && event.squareTo) {
      // if this is a premove
      if (this.status !== BOARD_STATUS.waitingOnMove) {
        this.premove = event;

        // remember the premove (only 1 premove allowed, check if there already was one.. etc)
        this.board.addMarker(this.markers.squareRed, event.squareFrom);
        this.board.addMarker(this.markers.squareRed, event.squareTo);

        return true;
      }

      // process the move
      this.afterMakeMove();
      // if this was a legal move
      if (event.legalMove) {
        // call the after move event
        this.afterMove(this.game.history({ verbose: true }).pop());
      }
    }
  }

  // called after a move was made
  afterMakeMove() {
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();

    // get the last move
    var last = this.game.history({ verbose: true }).pop();

    // add marker for last move
    this.board.removeMarkers();
    if (last) {
      this.board.addMarker(MARKER_TYPE.square, last.from);
      this.board.addMarker(MARKER_TYPE.square, last.to);
    }
  }
}
