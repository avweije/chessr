import { MyChess } from "./chess.js";
import { Chessboard, FEN } from "cm-chessboard/src/Chessboard.js";
import {
  COLOR,
  INPUT_EVENT_TYPE,
} from "cm-chessboard/src/view/ChessboardView.js";
import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

import "../styles/chessboard.css";

/**
 * Controller class for the practice page.
 */
class Home {
  board = null;
  boardElement = null;
  statisticsField = null;

  boardThemeSelect = null;
  boardPiecesSelect = null;
  animationDurationInput = null;
  variationAnimateCheckbox = null;

  settings = [];
  repertoire = [];

  animateInProgress = false;
  animateCancel = false;
  animateCounter = 0;

  constructor() {
    // get the elements
    this.boardElement = document.getElementById("board");
    this.statisticsField = document.getElementById("repertoireStatisticsField");
    this.boardThemeSelect = document.getElementById("boardThemeSelect");
    this.boardPiecesSelect = document.getElementById("boardPiecesSelect");
    this.animationDurationInput = document.getElementById(
      "animationDurationInput"
    );

    // add event listeners
    this.boardThemeSelect.addEventListener(
      "change",
      this.onChangeBoardSettings.bind(this)
    );
    this.boardPiecesSelect.addEventListener(
      "change",
      this.onChangeBoardSettings.bind(this)
    );
    this.animationDurationInput.addEventListener(
      "change",
      this.onChangeAnimationDuration.bind(this)
    );

    // get the settings
    this.getSettings();
    // get the entire repertoire
    this.getRepertoire();
  }

  // switch board theme
  onChangeBoardSettings(event) {
    // update the chessboard
    this.createChessboard(
      this.boardThemeSelect.value,
      this.boardPiecesSelect.value,
      this.animationDurationInput.value
    );
    // update the settings
    this.updateSettings();
  }

  // called when animation duration slider changes value
  onChangeAnimationDuration(event) {
    // cancel the current animation
    this.animateCancel = true;
    // update the board & the settings
    this.onChangeBoardSettings();
    // increase the animate id
    this.animateCounter++;
    // start the animation
    this.startAnimation();
  }

  //
  startAnimation() {
    // if already in progress
    if (this.animateInProgress) {
      // cancel the current animation
      this.animateCancel = true;
      // start the animation after a short pause
      setTimeout(() => {
        this.runAnimation(this.animateCounter);
      }, 500);
    } else {
      this.runAnimation(this.animateCounter);
    }
  }

  //
  async runAnimation(animateId) {
    console.log("runAnimation: " + animateId + " :: " + this.animateCounter);

    // if we need to run this animation
    if (animateId !== this.animateCounter) {
      return false;
    }

    // the moves we're going to animate
    var moves = [
      "e4",
      "c5",
      "c3",
      "Nf6",
      "e5",
      "Nd5",
      "Nf3",
      "d6",
      "Bb5+",
      "Bd7",
      "Bc4",
      "Nb6",
      "Bxf7+",
      "Kxf7",
      "e6+",
      "Bxe6",
      "Ng5+",
      "Kf6",
      "Qf3+",
      "Kxg5",
      "h4+",
      "Kg6",
      "h5+",
      "Kh6",
      "Qe3+",
      "g5",
      "Qxe6+",
      "Kg7",
      "h6#",
    ];

    this.animateInProgress = true;
    this.animateCancel = false;

    try {
      // create a new game
      var game = new MyChess();
      // set the board position
      this.board.setPosition(game.fen());
      // animate the moves 1 by 1
      for (var i = 0; i < moves.length; i++) {
        console.log("move: " + moves[i]);

        // make the move and get the info
        game.move(moves[i]);
        var last = game.history({ verbose: true }).pop();

        console.log(last);

        // animate the move
        await this.board.movePiece(last.from, last.to, true);

        // if we need to stop animating
        if (this.animateCancel) {
          this.animateCancel = false;
          break;
        }

        // update the board (in case of castling)
        this.board.setPosition(last.after);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.animateInProgress = false;
    }
  }

  // get the settings
  getSettings() {
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
      });
  }

  onGetSettings(settings) {
    console.log("onGetSettings:");
    console.log(settings);

    // store the settings
    this.settings = settings;

    // update the inputs with the settings
    if (settings.board) {
      this.boardThemeSelect.value = settings.board;
    }
    if (settings.pieces) {
      this.boardPiecesSelect.value = settings.pieces;
    }
    this.animationDurationInput.value = settings.animation;

    // create the chess board
    this.createChessboard(
      this.boardThemeSelect.value,
      this.boardPiecesSelect.value,
      this.animationDurationInput.value
    );
  }

  // update the settings
  updateSettings() {
    var url = "/api/settings";

    var data = {
      settings: {
        board: this.boardThemeSelect.value,
        pieces: this.boardPiecesSelect.value,
        animation: this.animationDurationInput.value,
      },
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
        console.log("Success:");
        console.log(response);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // get the repertoire
  getRepertoire() {
    var url = "/api/practice";

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
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      });
  }

  // enable the practice
  onGetRepertoire(json, group = null) {
    // store the repertoire
    this.repertoire = json;

    var whiteCount = this.getPracticeLines(this.repertoire["white"]);
    var blackCount = this.getPracticeLines(this.repertoire["black"]);
    var newCount = this.getPracticeLines(this.repertoire["new"]);
    var recommendedCount = this.getPracticeLines(
      this.repertoire["recommended"]
    );

    // set the statistics field
    if (whiteCount == 0 && blackCount == 0) {
      this.statisticsField.innerHTML =
        "You don't have a repertoire yet, start building one now and use it to practice your moves.";
    } else {
      this.statisticsField.innerHTML =
        "White: " +
        whiteCount +
        " " +
        (whiteCount == 1 ? "move" : "moves") +
        " | Black: " +
        blackCount +
        " " +
        (blackCount == 1 ? "move" : "moves");
      if (newCount > 0) {
        this.statisticsField.innerHTML +=
          " | New: " + newCount + " " + (newCount == 1 ? "move" : "moves");
      }
      if (recommendedCount > 0) {
        this.statisticsField.innerHTML +=
          " | Recommended: " +
          recommendedCount +
          " " +
          (recommendedCount == 1 ? "move" : "moves");
      }
    }
  }

  // create or update the chessboard
  createChessboard(
    cssClass = "chess-club",
    piecesFile = "standard.svg",
    animationDuration = 300
  ) {
    console.log("createChessboard:");
    console.log(cssClass, piecesFile, animationDuration);

    try {
      // if we are updating
      if (this.board) {
        // destroy the current board
        this.board.destroy();
        this.board = null;
      }

      // create the chess board
      this.board = new Chessboard(this.boardElement, {
        position: FEN.start,
        orientation: COLOR.white,
        assetsUrl: "/build/", // wherever you copied the assets folder to, could also be in the node_modules folder
        assetsCache: false,
        style: {
          cssClass: cssClass, // set the css theme of the board, try "green", "blue" or "chess-club"
          showCoordinates: true, // show ranks and files
          aspectRatio: 1, // height/width of the board
          pieces: {
            file: "pieces/" + piecesFile, // the filename of the sprite in `assets/pieces/` or an absolute url like `https://…` or `/…`
          },
          animationDuration: animationDuration, // pieces animation duration in milliseconds. Disable all animations with `0`
        },
      });
    } catch (err) {
      console.error(err);
    }
  }

  // split the repertoire into practice lines
  getPracticeLines(
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
      var lineMoveTotal = ourMove ? playableCnt : 0;

      // if this line has moves that follow
      if (lines[i].moves.length > 0) {
        // add this move to the line moves array
        var line = lineMoves.slice(0);
        if (lines[i].move) {
          line.push(lines[i].move);
        }

        // get the practice lines
        var sub = this.getPracticeLines(
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
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var home = new Home();
});
