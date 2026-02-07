#!/usr/bin/env python3
"""
EPSO AD5 Question Bank - Answer Distribution Fixer
This script randomizes the position of correct answers to achieve
a balanced distribution across all four positions (A, B, C, D).
"""

import json
import random
from collections import Counter
from pathlib import Path

def shuffle_question_answers(question):
    """
    Shuffle the answer options and update the correct answer index.
    
    Args:
        question (dict): Question with 'opts' and 'a' keys
    
    Returns:
        dict: Question with shuffled options
    """
    correct_answer_text = question['opts'][question['a']]
    
    # Create a shuffled copy of options
    shuffled_opts = question['opts'].copy()
    random.shuffle(shuffled_opts)
    
    # Find new index of correct answer
    new_correct_index = shuffled_opts.index(correct_answer_text)
    
    # Return updated question
    return {
        **question,
        'opts': shuffled_opts,
        'a': new_correct_index
    }

def get_answer_distribution(questions):
    """Get the distribution of correct answer positions."""
    positions = [q['a'] for q in questions]
    return Counter(positions)

def print_distribution(questions, title="Answer Distribution"):
    """Print the answer distribution statistics."""
    dist = get_answer_distribution(questions)
    total = len(questions)
    
    print(f"\n{title}")
    print("=" * 50)
    print(f"Total questions: {total}")
    print(f"\nPosition A (index 0): {dist[0]:3d} ({dist[0]/total*100:5.1f}%)")
    print(f"Position B (index 1): {dist[1]:3d} ({dist[1]/total*100:5.1f}%)")
    print(f"Position C (index 2): {dist[2]:3d} ({dist[2]/total*100:5.1f}%)")
    print(f"Position D (index 3): {dist[3]:3d} ({dist[3]/total*100:5.1f}%)")
    
    # Check if distribution is balanced
    max_percentage = max(dist.values()) / total * 100
    if max_percentage > 35:
        print(f"\n⚠️  WARNING: Unbalanced distribution (max {max_percentage:.1f}%)")
    else:
        print(f"\n✅ Distribution is balanced (max {max_percentage:.1f}%)")

def validate_questions(questions):
    """Validate that all questions are properly formatted."""
    errors = []
    
    for i, q in enumerate(questions):
        # Check required fields
        if 'q' not in q or not q['q']:
            errors.append(f"Q{i+1}: Missing or empty question text")
        
        if 'opts' not in q or len(q['opts']) != 4:
            errors.append(f"Q{i+1}: Must have exactly 4 options")
        
        if 'a' not in q or not isinstance(q['a'], int):
            errors.append(f"Q{i+1}: Missing or invalid answer index")
        
        if q['a'] < 0 or q['a'] > 3:
            errors.append(f"Q{i+1}: Answer index must be 0-3, got {q['a']}")
        
        if 'exp' not in q:
            errors.append(f"Q{i+1}: Missing explanation")
        
        if 'theme' not in q:
            errors.append(f"Q{i+1}: Missing theme")
        
        # Check for duplicate options
        if len(q['opts']) != len(set(q['opts'])):
            errors.append(f"Q{i+1}: Has duplicate answer options")
    
    return errors

def main():
    """Main function to fix answer distribution."""
    
    # Input and output file paths
    input_file = Path('/mnt/user-data/uploads/digital_cleaned_themed.json')
    output_file = Path('/home/claude/digital_randomized.json')
    
    print("EPSO AD5 - Answer Distribution Fixer")
    print("=" * 50)
    
    # Load questions
    print(f"\n📂 Loading questions from: {input_file}")
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            questions = json.load(f)
        print(f"✅ Loaded {len(questions)} questions")
    except Exception as e:
        print(f"❌ Error loading file: {e}")
        return
    
    # Validate questions
    print("\n🔍 Validating questions...")
    errors = validate_questions(questions)
    if errors:
        print(f"❌ Found {len(errors)} validation errors:")
        for error in errors[:10]:  # Show first 10 errors
            print(f"   {error}")
        if len(errors) > 10:
            print(f"   ... and {len(errors) - 10} more")
        
        response = input("\nContinue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Aborted.")
            return
    else:
        print("✅ All questions valid")
    
    # Show original distribution
    print_distribution(questions, "BEFORE: Original Answer Distribution")
    
    # Shuffle answers
    print("\n🔀 Randomizing answer positions...")
    random.seed(42)  # Set seed for reproducibility; remove for true randomness
    shuffled_questions = [shuffle_question_answers(q) for q in questions]
    
    # Show new distribution
    print_distribution(shuffled_questions, "AFTER: Randomized Answer Distribution")
    
    # Verify correct answers are preserved
    print("\n✅ Verifying correct answers preserved...")
    for i, (orig, shuffled) in enumerate(zip(questions, shuffled_questions)):
        orig_answer = orig['opts'][orig['a']]
        shuffled_answer = shuffled['opts'][shuffled['a']]
        if orig_answer != shuffled_answer:
            print(f"❌ ERROR: Q{i+1} correct answer changed!")
            print(f"   Original: {orig_answer}")
            print(f"   Shuffled: {shuffled_answer}")
            return
    print("✅ All correct answers preserved")
    
    # Save to file
    print(f"\n💾 Saving to: {output_file}")
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(shuffled_questions, f, indent=2, ensure_ascii=False)
        print("✅ File saved successfully")
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return
    
    # Create backup with timestamp
    import datetime
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = Path(f'/home/claude/digital_backup_{timestamp}.json')
    
    print(f"\n💾 Creating backup: {backup_file}")
    try:
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2, ensure_ascii=False)
        print("✅ Backup created")
    except Exception as e:
        print(f"⚠️  Warning: Could not create backup: {e}")
    
    print("\n" + "=" * 50)
    print("✅ COMPLETE! Answer distribution has been randomized.")
    print(f"\n📁 Output file: {output_file}")
    print(f"📁 Backup file: {backup_file}")
    print("\nNext steps:")
    print("1. Review the output file")
    print("2. Copy to your project: digital.v1.0.json")
    print("3. Test in your quiz application")
    print("=" * 50)

if __name__ == '__main__':
    main()
