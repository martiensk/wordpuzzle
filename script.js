// To use ES6 imports with Node.js, you'll need to either:
// 1. Save this file with a .mjs extension, or
// 2. Add "type": "module" to your package.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import PDFDocument from 'pdfkit';

// Get the directory name when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define page dimensions in points (72 points = 1 inch)
const PAGE_WIDTH = 8 * 72;  // 8 inches (576 points)
const PAGE_HEIGHT = 10 * 72; // 10 inches (720 points)
const BORDER_WIDTH = 6.35 * 2.83465; // 6.35mm converted to points (1mm = 2.83465pt)

// Function to read the input file and parse word lists
function readWordLists(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return fileContent.split('\n')
    .filter(line => line.trim())
    .map(line => line.split(',')
      .map(word => word.trim().toUpperCase())
      .filter(word => word)
    );
}

// Function to generate a grid for a word search puzzle
function generateWordSearch(words, size = 15) {
  // Initialize grid with empty cells
  const grid = Array(size).fill(0).map(() => Array(size).fill(''));
  const placedWords = [];
  const directions = [
    [0, 1],   // right
    [1, 0],   // down
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal down-left
    [0, -1],  // left
    [-1, 0],  // up
    [-1, 1],  // diagonal up-right
    [-1, -1]  // diagonal up-left
  ];
  
  // Sort words by length (longest first) to improve placement success
  const sortedWords = [...words].sort((a, b) => b.length - a.length);
  
  // Try to place each word
  for (const word of sortedWords) {
    if (word.length > size) {
      console.warn(`Warning: Word "${word}" is too long for the grid and will be skipped.`);
      continue;
    }
    
    let placed = false;
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!placed && attempts < maxAttempts) {
      attempts++;
      
      // Choose random starting position and direction
      const dirIndex = Math.floor(Math.random() * directions.length);
      const [dx, dy] = directions[dirIndex];
      const startX = Math.floor(Math.random() * size);
      const startY = Math.floor(Math.random() * size);
      
      // Check if word can be placed at this position and direction
      if (canPlaceWord(grid, word, startX, startY, dx, dy, size)) {
        // Place the word
        placeWord(grid, word, startX, startY, dx, dy);
        placedWords.push(word);
        placed = true;
      }
    }
    
    if (!placed) {
      console.warn(`Warning: Could not place word "${word}" after ${maxAttempts} attempts.`);
    }
  }
  
  // Fill empty cells with random letters
  fillEmptyCells(grid);
  
  return { grid, placedWords };
}

// Function to check if a word can be placed at given position and direction
function canPlaceWord(grid, word, startX, startY, dx, dy, size) {
  for (let i = 0; i < word.length; i++) {
    const x = startX + i * dx;
    const y = startY + i * dy;
    
    // Check if position is out of bounds
    if (x < 0 || x >= size || y < 0 || y >= size) {
      return false;
    }
    
    // Check if cell is empty or has the same letter
    if (grid[y][x] !== '' && grid[y][x] !== word[i]) {
      return false;
    }
  }
  
  return true;
}

// Function to place a word in the grid
function placeWord(grid, word, startX, startY, dx, dy) {
  for (let i = 0; i < word.length; i++) {
    const x = startX + i * dx;
    const y = startY + i * dy;
    grid[y][x] = word[i];
  }
}

// Function to fill empty cells with random letters
function fillEmptyCells(grid) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === '') {
        const randomIndex = Math.floor(Math.random() * letters.length);
        grid[y][x] = letters[randomIndex];
      }
    }
  }
}

// Function to create HTML for a word search puzzle
function createPuzzleHTML(grid, placedWords, index) {
  // Split words into two equal columns
  const midPoint = Math.ceil(placedWords.length / 2);
  const leftColumnWords = placedWords.slice(0, midPoint);
  const rightColumnWords = placedWords.slice(midPoint);
  
  let html = `
    <div class="puzzle" id="puzzle-${index}">
      <h2>Word Search Puzzle ${index + 1}</h2>
      <div class="grid">
        <table>
  `;
  
  // Create the grid
  for (let y = 0; y < grid.length; y++) {
    html += '<tr>';
    for (let x = 0; x < grid[y].length; x++) {
      html += `<td>${grid[y][x]}</td>`;
    }
    html += '</tr>';
  }
  
  html += `
        </table>
      </div>
      <div class="word-list">
        <h3>Word List:</h3>
        <div class="columns">
          <div class="column">
            <ul>
  `;
  
  // Left column words
  for (const word of leftColumnWords) {
    html += `<li>${word}</li>`;
  }
  
  html += `
            </ul>
          </div>
          <div class="column">
            <ul>
  `;
  
  // Right column words
  for (const word of rightColumnWords) {
    html += `<li>${word}</li>`;
  }
  
  html += `
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
  
  return html;
}

// Function to create an HTML file with all puzzles
function createHTMLFile(wordLists, outputPath) {
  // Calculate the content area dimensions (inside the border)
  const contentWidth = PAGE_WIDTH - (2 * BORDER_WIDTH);
  const contentHeight = PAGE_HEIGHT - (2 * BORDER_WIDTH);

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Word Search Puzzles</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .puzzle {
      page-break-after: always;
      margin: 0;
      padding: ${BORDER_WIDTH}px;
      box-sizing: border-box;
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .puzzle-content {
      border: 1px solid #cccccc;
      width: ${contentWidth}px;
      height: ${contentHeight}px;
      display: flex;
      flex-direction: column;
      padding: 20px;
      box-sizing: border-box;
    }
    h2 {
      text-align: center;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .grid {
      display: flex;
      justify-content: center;
      margin-bottom: 30px;
    }
    table {
      border-collapse: collapse;
    }
    td {
      width: 30px;
      height: 30px;
      text-align: center;
      font-weight: bold;
      border: 1px solid #ccc;
    }
    .word-list h3 {
      margin-bottom: 10px;
    }
    .columns {
      display: flex;
      justify-content: space-between;
    }
    .column {
      width: 48%;
    }
    ul {
      padding-left: 20px;
      margin-top: 5px;
    }
    @media print {
      .puzzle {
        page-break-after: always;
        width: ${PAGE_WIDTH}px;
        height: ${PAGE_HEIGHT}px;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  `;
  
  // Add each puzzle to the HTML
  for (let i = 0; i < wordLists.length; i++) {
    const { grid, placedWords } = generateWordSearch(wordLists[i]);
    
    html += `
    <div class="puzzle" id="puzzle-${i}">
      <div class="puzzle-content">
    `;
    
    // Add puzzle title
    html += `<h2>Word Search Puzzle ${i + 1}</h2>`;
    
    // Add grid
    html += `<div class="grid"><table>`;
    for (let y = 0; y < grid.length; y++) {
      html += '<tr>';
      for (let x = 0; x < grid[y].length; x++) {
        html += `<td>${grid[y][x]}</td>`;
      }
      html += '</tr>';
    }
    html += `</table></div>`;
    
    // Split words into two equal columns
    const midPoint = Math.ceil(placedWords.length / 2);
    const leftColumnWords = placedWords.slice(0, midPoint);
    const rightColumnWords = placedWords.slice(midPoint);
    
    // Add word list
    html += `
      <div class="word-list">
        <h3>Word List:</h3>
        <div class="columns">
          <div class="column">
            <ul>
    `;
    
    // Left column words
    for (const word of leftColumnWords) {
      html += `<li>${word}</li>`;
    }
    
    html += `
            </ul>
          </div>
          <div class="column">
            <ul>
    `;
    
    // Right column words
    for (const word of rightColumnWords) {
      html += `<li>${word}</li>`;
    }
    
    html += `
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
    `;
  }
  
  html += `
</body>
</html>
  `;
  
  // Write HTML to file
  fs.writeFileSync(outputPath, html);
  console.log(`HTML file created successfully at ${outputPath}`);
  
  return html;
}

// Function to capture screenshots of each puzzle
async function captureScreenshots(htmlPath, outputDir) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport to match page dimensions
  await page.setViewport({
    width: Math.round(PAGE_WIDTH),
    height: Math.round(PAGE_HEIGHT),
    deviceScaleFactor: 2 // Higher resolution for better quality
  });
  
  // Load the HTML file
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  
  // Get all puzzles
  const puzzleCount = await page.evaluate(() => {
    return document.querySelectorAll('.puzzle').length;
  });
  
  console.log(`Found ${puzzleCount} puzzles to capture.`);
  
  // Capture each puzzle
  const screenshotPaths = [];
  
  for (let i = 0; i < puzzleCount; i++) {
    const puzzleSelector = `#puzzle-${i}`;
    
    // Wait for puzzle to be fully rendered
    await page.waitForSelector(puzzleSelector);
    
    // Make sure only this puzzle is visible
    await page.evaluate((currentIndex, totalPuzzles, borderWidth) => {
        for (let j = 0; j < totalPuzzles; j++) {
          const puzzle = document.querySelector(`#puzzle-${j}`);
          if (puzzle) {
            puzzle.style.display = j === currentIndex ? 'block' : 'none';
          }
        }
        // Make sure puzzle fits in viewport
        const currentPuzzle = document.querySelector(`#puzzle-${currentIndex}`);
        if (currentPuzzle) {
          currentPuzzle.style.margin = '0';
          currentPuzzle.style.padding = `${borderWidth}px`;
          currentPuzzle.style.boxSizing = 'border-box';
        }
      }, i, puzzleCount, BORDER_WIDTH);
    
    // Take screenshot of the entire page
    const outputPath = path.join(outputDir, `puzzle-${i+1}.png`);
    await page.screenshot({ 
      path: outputPath,
      omitBackground: false,
      fullPage: false
    });
    
    screenshotPaths.push(outputPath);
    console.log(`Screenshot saved to ${outputPath}`);
  }
  
  await browser.close();
  
  return screenshotPaths;
}

// Function to create a PDF from screenshots
function createPDFFromScreenshots(screenshotPaths, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document with custom dimensions
      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margin: 0, // We'll manually handle margins
        autoFirstPage: false
      });
      
      const stream = fs.createWriteStream(outputPath);
      
      // Handle stream events
      stream.on('finish', () => {
        console.log(`PDF created successfully at ${outputPath}`);
        resolve();
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
      
      // Pipe the PDF document to the file stream
      doc.pipe(stream);
      
      // Add each screenshot as a page in the PDF
      screenshotPaths.forEach((screenshotPath) => {
        // Add a new page
        doc.addPage();
        
        // Add the image to fill the page
        // The screenshots already include the border
        doc.image(screenshotPath, 0, 0, {
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT
        });
      });
      
      // Finalize the PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

// Function to create PDFs directly without screenshots
function createPDFDirectly(wordLists, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document with custom dimensions
      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margin: 0, // We'll handle margins manually for more control
        autoFirstPage: false
      });
      
      const stream = fs.createWriteStream(outputPath);
      
      // Handle stream events
      stream.on('finish', () => {
        console.log(`PDF created successfully at ${outputPath}`);
        resolve();
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
      
      // Pipe the PDF document to the file stream
      doc.pipe(stream);
      
      // Calculate the content area dimensions (inside the border)
      const contentWidth = PAGE_WIDTH - (2 * BORDER_WIDTH);
      const contentHeight = PAGE_HEIGHT - (2 * BORDER_WIDTH);
      
      // Generate each puzzle
      wordLists.forEach((words, index) => {
        // Generate the puzzle
        const { grid, placedWords } = generateWordSearch(words);
        
        // Add a new page
        doc.addPage();
        
        // Draw border
        doc.rect(BORDER_WIDTH, BORDER_WIDTH, contentWidth, contentHeight)
           .stroke('#cccccc');
        
        // Content positioning starts at the border
        const startX = BORDER_WIDTH;
        const startY = BORDER_WIDTH;
        
        // Set content padding
        const padding = 20;
        const innerWidth = contentWidth - (2 * padding);
        
        // Draw title
        doc.fontSize(16)
           .text(`Word Search Puzzle ${index + 1}`, 
                 startX + padding, 
                 startY + padding, { 
                   align: 'center',
                   width: innerWidth
                 })
           .moveDown(1);
        
        // Calculate grid dimensions
        const cellSize = Math.min(20, (innerWidth) / grid.length);
        const gridWidth = cellSize * grid.length;
        const gridStartX = startX + padding + (innerWidth - gridWidth) / 2;
        let currentY = doc.y;
        
        // Draw the grid
        doc.fontSize(12);
        
        for (let y = 0; y < grid.length; y++) {
          for (let x = 0; x < grid[y].length; x++) {
            // Draw cell border
            doc.rect(gridStartX + x * cellSize, currentY + y * cellSize, cellSize, cellSize)
               .stroke('#cccccc');
            
            // Draw letter
            doc.text(grid[y][x], 
                     gridStartX + x * cellSize + (cellSize / 2) - 4, 
                     currentY + y * cellSize + (cellSize / 2) - 6);
          }
        }
        
        // Move down to word list section
        currentY = currentY + grid.length * cellSize + 30;
        doc.y = currentY;
        
        // Draw the word list title
        doc.fontSize(14)
           .text('Word List:', startX + padding, currentY, { 
             underline: true,
             width: innerWidth
           })
           .moveDown(0.5);
        
        // Split words into two columns
        const midPoint = Math.ceil(placedWords.length / 2);
        const leftColumnWords = placedWords.slice(0, midPoint);
        const rightColumnWords = placedWords.slice(midPoint);
        
        // Calculate column positions
        const columnWidth = innerWidth / 2;
        const leftColumnX = startX + padding;
        const rightColumnX = startX + padding + columnWidth;
        currentY = doc.y;
        
        // Draw left column words
        doc.fontSize(12);
        leftColumnWords.forEach(word => {
          doc.text(`• ${word}`, leftColumnX, doc.y, {
            width: columnWidth - 10,
            continued: false
          });
        });
        
        // Reset Y position and draw right column words
        doc.y = currentY;
        rightColumnWords.forEach(word => {
          doc.text(`• ${word}`, rightColumnX, doc.y, {
            width: columnWidth - 10,
            continued: false
          });
        });
      });
      
      // Finalize the PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

// Main function
async function main() {
  const inputPath = path.join(__dirname, 'input.txt');
  const htmlPath = path.join(__dirname, 'word-search-puzzles.html');
  const outputDir = path.join(__dirname, 'output');
  const screenshotPdfPath = path.join(outputDir, 'word-search-puzzles-from-screenshots.pdf');
  const directPdfPath = path.join(outputDir, 'word-search-puzzles.pdf');
  
  try {
    // Read word lists from input file
    const wordLists = readWordLists(inputPath);
    console.log(`Read ${wordLists.length} word lists from the input file.`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create HTML file with word search puzzles
    createHTMLFile(wordLists, htmlPath);
    
    // Method 1: Screenshot-based PDF
    console.log("Generating PDF from screenshots...");
    const screenshotPaths = await captureScreenshots(htmlPath, outputDir);
    await createPDFFromScreenshots(screenshotPaths, screenshotPdfPath);
    
    // Method 2: Direct PDF creation
    console.log("Generating PDF directly...");
    await createPDFDirectly(wordLists, directPdfPath);
    
    console.log('All operations completed successfully.');
    console.log(`Screenshots-based PDF: ${screenshotPdfPath}`);
    console.log(`Directly-created PDF: ${directPdfPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main();