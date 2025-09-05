import { MyChess } from "chess";


/**
 * 
 */
export class PgnField {
  pgnField = null;

  game = null;

  initialFen = "";
  currentMove = 0;
  currentVariation = -1;

  history = [];
  variations = [];

  /**
   * What do we want..
   * 
   * - reset(fen, moves) -> reset to fen, clear variations, set moves as main line
   * - resetToCurrent(fen) -> uses this.game.history(), I don't think we need the game here..
   * - isFirst(), isLast() -> we need to remember current move, this is part of it
   * - gotoFirst(), gotoLast() -> we need these too, we set current move so the pgn field 
   * highlights the current move. do we need to pass something to the controller?
   * or does the controller just call this to update the pgn field? and handles the rest themselves?
   * no... for the variations, the board needs to make all the moves from the start for it to be valid
   * so with the goTo() function, it needs to return the moves to make?
   * 
   * - add onGotoMove callback to do something after a gotoMove() call
   * 
   * - addMoveToHistory(move) -> adds a move to the history or variations - need this
   * - addVariation(moveNr, moves) -> adds a variation at moveNr with moves - need this
   * 
   * - getPgn(withVariations, pgnField) -> returns the pgn string, if pgnField is set, it updates it too
   * 
   * - setPgnField(element) -> sets the pgn field element - we do this in constructor now
   * 
   * - setPgnWithLinks(toggle) -> toggle links on/off, updates the pgn field
   * 
   * - updatePgnField() -> updates the pgn field if set
   * 
   * - getPgnWithLinks(withVariations) -> internal, keep
   * 
   * - getPgnForVariation(i, x, pgnField) -> internal, keep
   * 
   * - addPgnVariations(i, pgnField, groupSpan) -> internal, keep
   * 
   * - getHistoryMove(moveNr) -> returns an array of moves at moveNr, main line + variations
   * 
   */

  handlers = {};
  options = {};

  // The default options
  static defaultOptions = {
    navigationEnabled: true,  // Adds event listeners for left & right arrow keys for navigating the pgn
    useVariations: true,      // Allows the use of variations
    withLinks: true,          // Uses links in the pgn for navigation
    noLinkForLastMove: false, // Omits the link for the last move (only when withLinks = true)
    emptyText: null,          // Optionally display an empty text when there are no moves instead of '1.'
    pauseUpdate: false        // Temporarily pause the updating of the pgn field
  };

  constructor({
    container = null,
    options = {},
    handlers = {}
  }) {

    //console.log("pgnContainer", container, options, handlers);

    // the pgn field container
    this.pgnField = container;

    this.options = { ...PgnField.defaultOptions, ...options };

    //console.log("pgnField options:", this.options);

    const defaultHandlers = {
      onGotoMove: () => { }
    };

    this.handlers = { ...defaultHandlers, ...handlers };

    //console.log('pgnField handlers:', this.handlers);

    // create the chess game
    this.game = new MyChess();

    // add keydown event listeners for left/right (prev/next move)
    document.addEventListener("keydown", (event) => {
      // if navigation is enabled and arrow left/right was hit
      if (
        this.options.navigationEnabled &&
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

    // if no container, can we create it and return it??
  }

  // Set the container
  setContainer(container) {
    this.pgnField = container;
  }

  // update one or several options runtime
  setOptions(options = {}) {
    for (const [key, value] of Object.entries(options)) {
      if (!(key in PgnField.defaultOptions)) {
        throw new Error(`Invalid option: "${key}"`);
      }
      this.options[key] = value;
    }
  }


  /**
   * Reset history to a certain position with moves, clear variations, update pgn field
   * 
   * @param {string} fen 
   * @param {array} moves
   */

  _resetWithMoves(fen, moves = []) {
    // reset the game
    this.game.reset();
    // load the fen
    if (fen != "") this.game.load(fen);

    // wrap in try catch ??

    // make the moves
    for (let i = 0; i < moves.length; i++) {
      this.game.move(moves[i]);
    }

    this.history = this.game.history({ verbose: true });
    this.variations = [];

    // current move last sometimes? maybe through parameter..
    this.currentMove = 0;
    this.currentVariation = -1;
  }

  reset(fen = "", moves = []) {

    console.log("pgnField.reset", fen, moves);

    // reset the game and make the moves to get the correct history
    this._resetWithMoves(fen, moves);

    //console.log('PgnField - reset moves', moves);

    // we need to make the moves if we want to use this.game

    // update the pgn field
    this.updatePgnField();
  }

  /**
   * 
   * @param {*} fen 
   */
  resetToCurrent(fen = "", moves = []) {
    // reset the game and make the moves to get the correct history
    this._resetWithMoves(fen, moves);

    //console.log('PgnField - resetToCurrent', fen, this.history);

    // update the pgn field
    this.updatePgnField();
  }

  resetTo(moveNr) {

    //console.log('PgnField - resetTo history', this.game.history({ verbose: true }));

    // remove the last move until we reach moveNr
    while (this.game.history().length > moveNr) {
      this.removeLast();
    }
    // reset the history and variations
    this.history = this.game.history({ verbose: true });

    this.variations = [];
    this.currentMove = this.history.length;
    this.currentVariation = -1;
    // update the pgn field
    this.updatePgnField();
  }

  // addMove - addMoveToHistory

  removeLast() {
    // undo the move
    this.game.undo();
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

  //
  // need an addToHistory and removeFromHistory or undoLastMove function ??
  //

  isFirst() {
    // make sure we have the currentMove
    this.currentMove = this.currentMove == -1 ? this.history.length : this.currentMove;

    return this.currentMove == 0;
  }

  isLast() {
    // make sure we have the currentMove
    this.currentMove = this.currentMove == -1 ? this.history.length : this.currentMove;

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

  gotoMove(moveNr, variationIdx = -1, afterGotoMove = true) {
    var moves = [];

    // safety, 1st move minimum
    moveNr = Math.max(0, moveNr);

    console.info("PgnField - gotoMove", moveNr, variationIdx);

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

    // if this is the same move, no need to make it again..
    if (moveNr == this.currentMove && variationIdx == this.currentVariation) {
      // call the afterGotoMove handler
      if (afterGotoMove) {
        this.handlers.onGotoMove(moveNr, variationIdx);
      }

      return true;
    }

    // remember the current move & variation
    this.currentMove = moveNr;
    this.currentVariation = variationIdx;

    //console.log('PgnField gotoMove - currentMove: ', this.currentMove, this.currentVariation);

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

    //console.log("PgnField - gotoMove - moves to make:", moves);

    // update the PGN field
    this.updatePgnField();

    // call the afterGotoMove handler
    //if (afterGotoMove) {
    this.handlers.onGotoMove(moveNr, variationIdx, moves);
    //}

    return moves;
  }

  // goto 1st move main line
  gotoFirst() {

    //console.log('PgnField - gotoFirst');

    this.gotoMove(0);
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

    this.gotoMove(gotoMove, this.currentVariation, false);
  }

  // goto next move in current line or variation
  gotoNext() {
    // make sure we have the currentMove
    this.currentMove =
      this.currentMove == -1 ? this.history.length : this.currentMove;

    this.gotoMove(this.currentMove + 1, this.currentVariation, false);
  }

  //
  addMoveToHistory(move) {

    console.info("PgnField.addMoveToHistory", move, this.game.history());

    try {

      // make the move
      move = this.game.move(move);

      // get the move we just made
      //move = this.game.history({ verbose: true }).pop();

      // get the current move index
      //var moveNr = this.game.moveNumber();
      var moveNr = this.game.history().length;

      console.log("PgnField addMoveToHistory - moveNr:", moveNr, this.currentVariation);

      // if we are in the main line
      if (this.currentVariation == -1) {
        // if this is a new move
        if (this.history.length < moveNr) {
          // add the move to the main line
          this.history.push(move);
        } else {
          //

          if (this.options.useVariations) {
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
            this.history.splice(moveNr - 1, this.history.length, move);
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

      //console.log('PgnField currentMove:', moveNr, this.history);

      //
      this.currentMove = moveNr;

      // update the pgn field
      this.updatePgnField();
    } catch (err) {
      console.warn(err);
    }
  }

  addVariation(moveNr, moves) {

    console.info("addVariation", moveNr, moves);

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
    }

    // create a game to make the moves
    var game = new MyChess();
    if (this.initialFen != "") {
      game.load(this.initialFen);
    }

    //console.log('PgnField - addVariation - make moves', moveNr, this.history);

    // play all moves up to moveNr - 1
    for (var i = 0; i < moveNr - 1; i++) {
      game.move(this.history[i].san);
    }

    // play all the new moves
    var madeMoves = [];
    for (var i = 0; i < moves.length; i++) {
      game.move(moves[i]);
      madeMoves.push(game.history({ verbose: true }).pop());
    }

    // always add as a variation
    this.variations.push({
      moveNr: moveNr,           // starting move number
      parent: currVar >= 0 ? currVar : null, // attach to parent if one was found
      moves: madeMoves,
    });

    // return the index of the newly added variation
    return this.variations.length - 1;
  }

  setPgnWithLinks(toggle = true) {
    this.options.withLinks = toggle;
    // update the pgn field
    this.updatePgnField();
  }

  updatePgnField() {

    console.log("updatePgnField", this.pgnField, this.options?.pauseUpdate);

    if (this.pgnField && !this.options?.pauseUpdate) {
      this.getPgn(this.options.useVariations, this.pgnField);
    }
  }

  getPgnWithLinks(withVariations = true) {
    return this.getPgn(withVariations, true);
  }

  getPgn(withVariations = true, pgnField = null) {
    var pgn = "";

    console.log('PgnField.getPgn', withVariations, pgnField, this.history);

    if (pgnField) {
      pgnField.innerHTML = "";

      // if there are no moves yet, add the 1.
      if (this.history.length == 0) {
        // create the move-group span
        const groupSpan = document.createElement('span');
        groupSpan.className = 'pgn-move-group';
        // create the move number span
        const nrSpan = document.createElement('span');
        nrSpan.classList.add('pgn-text');
        // If we have an emptyText option, show that instead of 1.
        if (this.options.emptyText && this.options.emptyText != "") {
          nrSpan.innerHTML = this.options.emptyText;
        } else {
          nrSpan.classList.add('move-number');
          nrSpan.innerHTML = '1.';
        }

        groupSpan.appendChild(nrSpan);
        pgnField.appendChild(groupSpan);
      }
    }

    // make sure we have the currentMove
    var currentMove = this.currentMove == -1 ? this.history.length : this.currentMove;

    //console.log("PgnField getPgn", withVariations, this.currentMove, this.history, this.options);

    let groupSpan = null;
    // loop through the moves
    for (var i = 0; i < this.history.length; i++) {
      var moveNr = Math.floor(i / 2) + 1;

      if (i % 2 == 0) {
        // add the previous group span
        if (i > 0) {
          if (pgnField && groupSpan) {
            pgnField.appendChild(groupSpan);
          }
        }

        // create the move-group span
        groupSpan = document.createElement('span');
        groupSpan.className = 'pgn-move-group';

        pgn += moveNr + ". ";

        if (pgnField) {
          const nrSpan = document.createElement("span");
          nrSpan.className = 'pgn-text move-number';
          nrSpan.innerHTML = moveNr + ".";

          groupSpan.appendChild(nrSpan);
        }
      }

      pgn += this.history[i].san + " ";

      if (pgnField) {
        var moveSpan = document.createElement("span");

        //console.log('getPgn - currentMove:', i, this.history.length, this.options);

        // Add move or text styling
        if (this.options.withLinks && !(this.options.noLinkForLastMove && i + 1 == this.history.length)) {
          moveSpan.classList.add('pgn-move');
        } else {
          moveSpan.classList.add('pgn-text');
        }
        // Add current move styling
        if (this.currentVariation == -1 && currentMove == i + 1) {
          moveSpan.classList.add('current-move')
        }

        moveSpan.innerHTML = this.history[i].san;
        moveSpan.setAttribute("data-move", i + 1);

        // add event listener
        if (this.options.withLinks) {
          moveSpan.addEventListener("click", (event) => {
            // goto a certain move
            this.gotoMove(event.target.getAttribute("data-move"));
          });
        }

        groupSpan.appendChild(moveSpan);
      }

      // Add variations if included
      if (this.options.useVariations && withVariations) {
        this.addPgnVariations(i, pgnField, groupSpan);
      }
    }

    // Add the current group span and reset it
    if (pgnField && groupSpan) {
      pgnField.appendChild(groupSpan);
      groupSpan = null;
    }

    // Add variations if included
    if (this.options.useVariations && withVariations) {
      this.addPgnVariations(this.history.length, pgnField, groupSpan);
    }

    return pgn.trim();
  }

  addPgnVariations(i, pgnField, groupSpan) {
    let groupRecreated = false;
    let pgn = '';
    for (var x = 0; x < this.variations.length; x++) {
      if (
        this.variations[x].parent == null &&
        this.variations[x].moveNr == i + 1
      ) {
        // Add the current group span and reset it
        if (pgnField && !groupRecreated && groupSpan) {
          pgnField.appendChild(groupSpan);
          // recreate the move-group span
          groupSpan = document.createElement('span');
          groupSpan.className = 'pgn-move-group';
        }
        pgn += this.getPgnForVariation(i, x, pgnField);
      }
    }
    return pgn;
  }

  getPgnForVariation(i, x, pgnField) {
    var pgn = '<span class="pgn-moves-variation">(';

    if (pgnField) {
      var sp = document.createElement("span");
      sp.classList.add('is-variation');
      sp.classList.add('pgn-text');

      sp.innerHTML = "(";

      pgnField.appendChild(sp);
    }

    var moveNr = Math.floor(i / 2) + 1;

    if (i % 2 == 1) {
      pgn += moveNr + "... ";

      if (pgnField) {
        var sp = document.createElement("span");
        sp.classList.add('is-variation');
        sp.classList.add('pgn-text');
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
          sp.classList.add('is-variation');
          sp.classList.add('pgn-text');
          sp.classList.add('move-number');
          sp.innerHTML = moveNr + ".";
          pgnField.appendChild(sp);
        }
      }
      pgn += this.variations[x].moves[y].san + " ";

      if (pgnField) {
        var sp = document.createElement("span");
        sp.classList.add('is-variation');

        // Add move or text styling
        if (this.options.withLinks) {
          sp.classList.add('pgn-move');
        } else {
          sp.classList.add('pgn-text');
        }

        // Add current move styling
        if (this.currentVariation == x && this.currentMove == i + y + 1) {
          sp.classList.add('current-move');
        }

        sp.innerHTML = this.variations[x].moves[y].san;
        sp.setAttribute("data-variation", x);
        sp.setAttribute("data-move", i + y + 1);

        // add event listener
        if (this.options.withLinks) {
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
      sp.classList.add('is-variation');
      sp.classList.add('pgn-text');

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

}
