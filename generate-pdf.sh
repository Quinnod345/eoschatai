#!/bin/bash

# EOS AI Bot Meeting Questions - PDF Generator
# This script installs dependencies and generates a PDF from the markdown file

set -e  # Exit on any error

echo "🚀 EOS AI Bot PDF Generator"
echo "================================="

# Check if the markdown file exists
if [ ! -f "EOS_AI_Bot_Meeting_Questions.md" ]; then
    echo "❌ Error: EOS_AI_Bot_Meeting_Questions.md not found in current directory"
    echo "Please make sure you're running this script from the project root"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    echo "Please install pnpm first: https://pnpm.io/installation"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate PDF
echo "📄 Generating PDF from markdown..."
if pnpm run render-pdf; then
    echo ""
else
    echo "❌ Error: PDF generation command failed"
    exit 1
fi

# Check if PDF was generated successfully
if [ -f "EOS_AI_Bot_Meeting_Questions.pdf" ]; then
    echo ""
    echo "✅ Success! PDF generated successfully:"
    echo "   📄 EOS_AI_Bot_Meeting_Questions.pdf"
    echo "   🔧 EOS_AI_Bot_Meeting_Questions.html (debug file)"
    echo ""
    echo "🎉 Your meeting document is ready!"
    
    # Try to open the PDF (macOS)
    if command -v open &> /dev/null; then
        echo "📖 Opening PDF..."
        open EOS_AI_Bot_Meeting_Questions.pdf
    # Try to open the PDF (Linux)
    elif command -v xdg-open &> /dev/null; then
        echo "📖 Opening PDF..."
        xdg-open EOS_AI_Bot_Meeting_Questions.pdf
    else
        echo "📍 PDF saved to: $(pwd)/EOS_AI_Bot_Meeting_Questions.pdf"
    fi
else
    echo "❌ Error: PDF generation failed"
    echo "Check the output above for error details"
    echo "You can also check the HTML file for debugging: EOS_AI_Bot_Meeting_Questions.html"
    exit 1
fi 