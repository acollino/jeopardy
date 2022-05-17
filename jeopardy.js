// categories is the main data structure for the app; it looks like this:

//  [
//    { title: "Math",
//      clues: [
//        {question: "2+2", answer: 4, showing: null},
//        {question: "1+1", answer: 2, showing: null}
//        ...
//      ],
//    },
//    { title: "Literature",
//      clues: [
//        {question: "Hamlet Author", answer: "Shakespeare", showing: null},
//        {question: "Bell Jar Author", answer: "Plath", showing: null},
//        ...
//      ],
//    },
//    ...
//  ]

const NUM_CATEGORIES = 6;
const NUM_QUESTIONS_PER_CAT = 5;

/** From testing with the jService API, category IDs start at 1 and
 *  end at 18418.
 */
const NUM_API_CATEGORIES = 18418;
const categoryIDSet = new Set();

/** From testing with the jService API, clue values cap at 1000
 */
const NUM_MAX_CLUE_VALUE = 1000;

let categories = [];

function getCategoriesFromIDSet(categoryIDSet) {
  let categoryArray = [];
  categoryIDSet.forEach((id) => {
    categoryArray.push(getCategory(id));
  });
  return Promise.all(categoryArray);
}

function getCategory(categoryID) {
  return fetch(`https://jservice.io/api/category?id=${categoryID}`)
    .then((response) => response.json())
    .catch(() => {
      return { category: "", id: -1, clues: [] };
    });
}

function getRandomIDSet(numIDs, maxValue) {
  let uniqueIDSet = new Set();
  while (uniqueIDSet.size < numIDs) {
    let randomID = 1 + Math.floor(Math.random() * maxValue);
    if (!categoryIDSet.has(randomID)) {
      uniqueIDSet.add(randomID);
    }
  }
  return uniqueIDSet;
}

function getUniqueClues(category) {
  let validClueArray = category.clues.filter((clue) => {
    return clue.question !== "" && clue.invalid_count === null;
  });
  let uniqueClueQuestionSet = new Set();
  let uniqueClueIDSet = new Set();
  validClueArray.forEach((clue) => {
    if (!uniqueClueQuestionSet.has(clue.question)) {
      uniqueClueQuestionSet.add(clue.question);
      uniqueClueIDSet.add(clue.id);
    }
  });
  return validClueArray.filter((clue) => uniqueClueIDSet.has(clue.id));
}

function sortClueDifficulty(clueArray) {
  let difficultyIncreaseValue = NUM_MAX_CLUE_VALUE / NUM_QUESTIONS_PER_CAT;
  let clueMap = new Map();
  clueArray.forEach((clue) => {
    let index = Math.round(Number(clue.value) / difficultyIncreaseValue);
    if (!clueMap.has(index)) {
      clueMap.set(index, []);
    }
    clueMap.get(index).push(clue);
  });
  return clueMap;
}

function hardestCluesFromIndex(index, sortedClueMap) {
  let counter = index;
  while (!sortedClueMap.has(counter) && counter > 0) {
    counter--;
  }
  let cluesFromIndex = sortedClueMap.get(counter);
  if (cluesFromIndex.length === 1) {
    sortedClueMap.delete(counter);
  }
  return cluesFromIndex;
}

function getRandomClueFromIndex(index, sortedClueMap) {
  let cluesFromIndex = hardestCluesFromIndex(index, sortedClueMap);
  let randomClueIndex = Math.floor(Math.random() * cluesFromIndex.length);
  return cluesFromIndex.splice(randomClueIndex, 1)[0];
}

function buildClueArray(sortedClueMap) {
  let clueArray = Array.from({ length: NUM_QUESTIONS_PER_CAT });
  for (let x = 0; x < clueArray.length; x++) {
    clueArray[x] = getRandomClueFromIndex(x + 1, sortedClueMap);
  }
  return clueArray;
}

function filterCategories(categoryArray, numClues) {
  let filteredCategories = [];
  categoryArray.forEach((category) => {
    let uniqueClues = getUniqueClues(category);
    if (uniqueClues.length >= numClues) {
      let clues = buildClueArray(sortClueDifficulty(uniqueClues));
      categoryIDSet.add(category.id);
      let uniqueCategory = { title: category.title, clues };
      filteredCategories.push(shortenCategory(uniqueCategory));
    }
  });
  return filteredCategories;
}

async function getValidCategories(amountCategories) {
  let idSet = getRandomIDSet(amountCategories, NUM_API_CATEGORIES);
  let categoriesFromID = await getCategoriesFromIDSet(idSet);
  return filterCategories(categoriesFromID, NUM_QUESTIONS_PER_CAT);
}

async function fillArrayWithValidCategories() {
  console.time("getting data");
  let amountCategories = NUM_CATEGORIES;
  categories = await getValidCategories(amountCategories);
  while (categories.length < NUM_CATEGORIES) {
    let missingCategoryNum = NUM_CATEGORIES - categories.length;
    categories = categories.concat(
      await getValidCategories(missingCategoryNum)
    );
  }
  console.timeEnd("getting data");
}

function shortenCategory(categoryObj) {
  let { title, clues } = categoryObj;
  let shortenedClues = [];
  for (let clue of clues) {
    let { question, answer, value } = clue;
    shortenedClues.push({
      question: removeHTML(question),
      answer: removeHTML(answer),
      value,
      showing: null,
    });
  }
  return { title: removeHTML(title), clues: shortenedClues };
}

function removeHTML(htmlString) {
  let parser = new DOMParser();
  return parser
    .parseFromString(htmlString, "text/html")
    .body.textContent.toUpperCase()
    .replace("\\'", "'");
}

/** Fill the HTML table#jeopardy with the categories & cells for questions.
 *
 * - The <thead> should be filled w/a <tr>, and a <td> for each category
 * - The <tbody> should be filled w/NUM_QUESTIONS_PER_CAT <tr>s,
 *   each with a question for each category in a <td>
 *   (initally, just show a "?" where the question/answer would go.)
 */

async function fillTable() {
  const $table = $("#jeopardy");
  const $tableHead = $("<thead><tr>");
  const $tableBody = $("<tbody>");
  for (let category of categories) {
    $tableHead
      .find("tr")
      .append($(`<td class="category-title">${category.title}</td>`));
  }
  for (let x = 0; x < NUM_QUESTIONS_PER_CAT; x++) {
    const $questionRow = $("<tr>");
    let displayValue = (NUM_MAX_CLUE_VALUE / NUM_QUESTIONS_PER_CAT) * (x + 1);
    displayValue = Math.round(displayValue / 50) * 50;
    for (let y = 0; y < NUM_CATEGORIES; y++) {
      const $clue = $(`<td class="clue">$${displayValue}</td>`);
      $clue.addClass("unclicked").data({ categoryIndex: y, clueIndex: x });
      $questionRow.append($clue);
    }
    $tableBody.append($questionRow);
  }
  $table.append($tableHead);
  $table.append($tableBody);
}

/** Handle clicking on a clue: show the question or answer.
 *
 * Uses .showing property on clue to determine what to show:
 * - if currently null, show question & set .showing to "question"
 * - if currently "question", show answer & set .showing to "answer"
 * - if currently "answer", ignore click
 * */

function handleClick(evt) {
  const $clue = $(evt.target).closest(".clue");
  let { categoryIndex, clueIndex } = $clue.data();
  let clueInfo = categories[categoryIndex].clues[clueIndex];
  if (clueInfo.showing === null) {
    clueInfo.showing = "flipQandA";
    $clue.addClass("shrink");
    $clue.on("animationiteration", () => {
      $clue.removeClass("unclicked").addClass("clue-q-and-a").text("");
      addFaces($clue, clueInfo);
    });
    $clue.on("animationend", () => {
      $clue.removeClass(["shrink"]);
    });
    return;
  } else if (clueInfo.showing === "flipQandA") {
    $clue.toggleClass("flip");
    return;
  }
}

function addFaces($clue, clueInfo) {
  let $faceFront = $('<div class="face">');
  $faceFront.text(clueInfo.question);
  let $faceBack = $('<div class="face">');
  $faceBack.text(clueInfo.answer);
  $clue.append([$faceFront, $faceBack]);
}

/** Wipe the current Jeopardy board, show the loading spinner,
 * and update the button used to fetch data.
 */

/** Note - implemented here for completeness, but showLoadingView and
 *  hideLoadingView could be simplified by using the jQuery toggle()
 *  function on the elements changing visibility in a single
 *  toggleLoadingState() function instead.
 *
 */
function showLoadingView() {
  $("#jeopardy").hide();
  $("#restart").hide();
  $(".loading").show();
}

/** Remove the loading spinner and update the button used to fetch data. */

function hideLoadingView() {
  $("#jeopardy").show();
  $("#restart").show();
  $(".loading").hide();
}

/** Start game:
 *
 * - get random category Ids
 * - get data for each category
 * - create HTML table
 * */

/** Note - normally, I would create the button in the HTML file instead of
 *  in the JS code, however the given instructions state:
 *    "We’ve provided an HTML file and CSS for the application
 *     (you shouldn’t change the HTML file; if you want to tweak
 *     any CSS things, feel free to)."
 */
async function setupAndStart() {
  const $loadingCircle = $(`<div class="loading">`);
  $("body").append($loadingCircle);
  await fillArrayWithValidCategories().then(function () {
    const $gameTable = $('<table id="jeopardy">').hide();
    const $restartButton = $('<button id="restart">Restart</button>').hide();
    $restartButton.on("click", restart);
    $("body").append([$gameTable, $restartButton]);
    fillTable();
    hideLoadingView();
  });
}

/** On click of start / restart button, set up game. */

async function restart() {
  showLoadingView();
  $("#jeopardy").empty();
  categoryIDSet.clear();
  await fillArrayWithValidCategories().then(function () {
    fillTable();
    hideLoadingView();
  });
}

/** On page load, add event handler for clicking clues */

/** Note - this could have been done using a listener for the "load" or
 * "DOMContentLoaded" events to trigger adding the event handler. I opted
 *  to use event delegation instead, as it means only one event handler is
 *  needed, rather than adding one handler to trigger adding another.
 */
$("body").on("click", ".clue", handleClick);

setupAndStart();