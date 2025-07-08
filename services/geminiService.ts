
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ProjectTask, SubStep, SlideDeck, ActionItem, TextboxElement, Slide, ProjectHealthReport, GanttItem, FlowchartElement, Decision } from '../types';
import { GEMINI_MODEL_TEXT } from '../constants';

let ai: GoogleGenAI | null = null;

export const initializeGemini = (apiKey: string) => {
  if (!apiKey) {
    ai = null;
    return;
  }
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error("Failed to initialize Gemini AI:", error);
    ai = null;
  }
};


// --- NEW DATA PRUNING HELPERS to avoid token limits ---

/**
 * Creates a "lighter" version of task data to send to the AI,
 * removing large or irrelevant fields to prevent exceeding token limits.
 * @param data A single ProjectTask or an array of ProjectTask.
 * @returns The pruned data.
 */
const pruneDataForAI = (data: ProjectTask | ProjectTask[]): any => {
    const processTask = (task: ProjectTask): any => {
        const { position, extendedDetails, ...restOfTask } = task;

        const lightTask: any = { ...restOfTask };

        if (extendedDetails) {
            const { 
                reportDeck, 
                attachments: taskAttachments,
                subSteps,
                decisions, // Explicitly remove decisions from the main task object as it's handled separately
                ...restOfDetails 
            } = extendedDetails;

            const lightDetails: any = { ...restOfDetails };

            if (reportDeck && reportDeck.slides.length > 0) {
                lightDetails.reportDeckExists = true;
                lightDetails.reportDeckSlideCount = reportDeck.slides.length;
            }

            if (taskAttachments && taskAttachments.length > 0) {
                lightDetails.attachments = taskAttachments.map(att => ({
                    id: att.id, name: att.name, type: att.type,
                }));
            }

            if (subSteps && subSteps.length > 0) {
                lightDetails.subSteps = subSteps.map(subStep => {
                    const { position, attachments: subStepAttachments, actionItems, ...restOfSubStep } = subStep;
                    const lightSubStep: any = { ...restOfSubStep };
                    
                    if (subStepAttachments && subStepAttachments.length > 0) {
                        lightSubStep.attachments = subStepAttachments.map(att => ({
                            id: att.id, name: att.name, type: att.type,
                        }));
                    }
                    
                    if (actionItems && actionItems.length > 0) {
                        lightSubStep.actionItems = actionItems.map(item => {
                            const { report, ...restOfItem } = item;
                            const lightItem: any = { ...restOfItem };
                            if (report) {
                                const { attachments: reportAttachments, ...restOfReport } = report;
                                const lightReport: any = { ...restOfReport };
                                if (reportAttachments && reportAttachments.length > 0) {
                                    lightReport.attachments = reportAttachments.map(att => ({
                                        id: att.id, name: att.name, type: att.type
                                    }));
                                }
                                lightItem.report = lightReport;
                            }
                            return lightItem;
                        });
                    }
                    return lightSubStep;
                });
            }
            lightTask.extendedDetails = lightDetails;
        }

        return lightTask;
    };

    if (Array.isArray(data)) {
        return data.map(processTask);
    } else {
        return processTask(data as ProjectTask);
    }
};

/**
 * Creates a "lighter" version of a slide deck to send to the AI.
 * @param deck The SlideDeck to prune.
 * @returns The pruned slide deck.
 */
const pruneSlideDeckForAI = (deck: SlideDeck): any => {
    return {
        ...deck,
        slides: deck.slides.map(slide => {
            if (slide.isLocked) {
                 return {
                    id: slide.id,
                    isLocked: true,
                    summary: `Locked Slide: Contains ${slide.elements.length} elements. Content is preserved and must not be changed.`,
                    elements: [] // Empty elements for locked slides to save tokens
                };
            }
            const { elements, ...restOfSlide } = slide;
            return {
                ...restOfSlide,
                elements: elements.map(el => {
                    if (el.type === 'flowchart' && (el as FlowchartElement).data?.subSteps) {
                        const flowchartEl = el as FlowchartElement;
                        return {
                            ...flowchartEl,
                            data: {
                                subStepCount: flowchartEl.data.subSteps.length,
                                subSteps: `[Sub-step data omitted for brevity, count: ${flowchartEl.data.subSteps.length}]`
                            }
                        };
                    }
                    return el;
                })
            };
        })
    };
};

// --- END DATA PRUNING HELPERS ---


/**
 * Sanitizes "dependencies" arrays in a JSON string, which are prone to AI hallucinations.
 * It extracts all valid string literals from the array and reconstructs it.
 * @param jsonStr The raw JSON string.
 * @returns A sanitized JSON string.
 */
const sanitizeDependencyArrays = (jsonStr: string): string => {
  // This regex finds all "dependencies" arrays and captures their content.
  // The 'g' flag ensures all occurrences are replaced.
  const dependenciesRegex = /"dependencies"\s*:\s*\[([\s\S]*?)\]/g;

  return jsonStr.replace(dependenciesRegex, (match, content) => {
    // Inside the array content, find all valid string literals ("...").
    const stringLiterals = content.match(/"[^"]*"/g);
    
    // Reconstruct the array content by joining the found literals with commas.
    // If no valid literals are found, create an empty array.
    const sanitizedContent = stringLiterals ? stringLiterals.join(', ') : '';
    
    // Return the reconstructed "dependencies" array.
    return `"dependencies": [${sanitizedContent}]`;
  });
};


/**
 * Parses a JSON object from a string, attempting to clean it up first.
 * @param text The raw string response from the AI.
 * @returns A parsed object of type T, or null if parsing fails.
 */
const parseJsonFromText = <T,>(text: string): T | null => {
  let jsonStr = text.trim();
  
  // 1. Extract content from markdown fences if they exist.
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }

  // 2. Sanitize "dependencies" arrays. This is specific and seems safe.
  jsonStr = sanitizeDependencyArrays(jsonStr);

  // 3. A safer method to handle "Bad control character" errors.
  // This error is almost always caused by an unescaped newline or tab inside a string value.
  // This replacement ONLY affects characters within double quotes.
  // It finds string literals ("...") and for each one, runs a function to escape internal control characters.
  jsonStr = jsonStr.replace(/"((?:\\.|[^"\\])*)"/g, (match, content) => {
    const sanitizedContent = content
      .replace(/\n/g, '\\n') // escape newlines
      .replace(/\r/g, '\\r') // escape carriage returns
      .replace(/\t/g, '\\t'); // escape tabs
    return `"${sanitizedContent}"`;
  });
  
  // 4. If no markdown fence was found, try to crudely extract the JSON block.
  if (!match) {
    const firstBrace = jsonStr.indexOf('{');
    const firstBracket = jsonStr.indexOf('[');
    
    if (firstBrace === -1 && firstBracket === -1) {
      console.error("No JSON object or array found in the response string.", text);
      throw new Error(`AI response did not contain a valid JSON structure. Raw response: ${text.substring(0, 500)}...`);
    }

    const start = firstBrace === -1 ? firstBracket : (firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket));
    const lastBrace = jsonStr.lastIndexOf('}');
    const lastBracket = jsonStr.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    
    if (start > -1 && end > start) {
      jsonStr = jsonStr.substring(start, end + 1);
    }
  }

  // 5. Attempt to parse the cleaned JSON.
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response:", e, "\nOriginal text:", text, "\nProcessed string:", jsonStr);
    throw new Error(`Failed to parse AI response as JSON. Raw response: ${text.substring(0, 500)}...`);
  }
};

/**
 * Centralized error handler for Gemini API calls.
 * @param error The error object caught from the API call.
 * @param context A string describing the context of the call (e.g., 'project plan generation').
 */
const handleGeminiError = (error: unknown, context: string): never => {
    console.error(`Error in Gemini API call during ${context}:`, error);
    
    let finalMessage = `AIとの通信中に不明なエラーが発生しました (${context})。`;
    
    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('api key not valid') || errorMessage.includes('api key is invalid')) {
            finalMessage = 'APIキーが無効です。キーを確認して再度設定してください。(API key not valid. Please pass a valid API key.)';
        } else if (errorMessage.includes('quota')) {
            finalMessage = "API利用上限に達しました。Google AI Platformのプランと請求情報を確認してください。(You have exceeded your API quota.)";
        } else {
            finalMessage = `AIとの通信に失敗しました (${context}): ${error.message}`;
        }
    }

    throw new Error(finalMessage);
};


export const generateProjectPlan = async (goal: string, date: string): Promise<ProjectTask[]> => {
  if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
  const prompt = `
    You are an expert project planner. Your task is to break down a high-level project goal into a sequence of actionable tasks.
    CONTEXT:
    - Project Goal: "${goal}"
    - Target Completion Date: "${date}"
    INSTRUCTIONS:
    1.  Generate a sequence of 3 to 7 high-level, actionable tasks.
    2.  Provide a concise title (max 10 words) and a brief description (1-2 sentences) for each.
    3.  Your response MUST be a single, valid JSON array of objects. Do NOT include any explanations or markdown fences.
    4.  The language of the output should match the language of the input goal.
    5.  Each object MUST have this structure: { "id": "unique_string_id", "title": "Task Title", "description": "Task Description" }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
    });
    const tasks = parseJsonFromText<ProjectTask[]>(response.text);
    if (!tasks || !Array.isArray(tasks) || tasks.some(task => !task.id || !task.title || !task.description)) {
        throw new Error("AI returned an unexpected format for project tasks.");
    }
    return tasks;
  } catch (error) {
    handleGeminiError(error, 'project plan generation');
  }
};

export const generateStepProposals = async (task: ProjectTask): Promise<{ title: string; description: string; }[]> => {
  if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
  const prompt = `
    You are a project management expert. Analyze the given task and propose a list of concrete next steps to accomplish it.
    CONTEXT:
    - Task Title: "${task.title}"
    - Task Description: "${task.description}"
    - Required Resources: "${task.extendedDetails?.resources || 'Not specified'}"
    INSTRUCTIONS:
    1.  Generate a list of 3 to 6 actionable proposals (sub-steps).
    2.  Each proposal must have a concise 'title' and a 'description'.
    3.  Focus on breaking down the main task into logical phases or components.
    4.  Your response MUST be a single, valid JSON array of objects. Do not include any explanations.
    5.  The language must match the input task language.
    6.  The JSON structure for each item must be: { "title": "...", "description": "..." }
  `;
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
    });
    const proposals = parseJsonFromText<{ title: string; description: string; }[]>(response.text);
    if (!proposals || !Array.isArray(proposals) || proposals.some(p => !p.title || !p.description)) {
        throw new Error("AI returned an unexpected format for step proposals.");
    }
    if (proposals.length === 0) {
        throw new Error("AI did not generate any proposals. The task might be too abstract.");
    }
    return proposals;
  } catch (error) {
    handleGeminiError(error, 'step proposal generation');
  }
};

export const generateDecisions = async (task: ProjectTask, existingDecisions: Decision[]): Promise<Decision[]> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
        You are a senior project analyst AI. Your task is to intelligently update a list of critical project decisions based on the latest task data. You will merge new findings with an existing list.

        CONTEXT:
        - Full Task Data (JSON, pruned for brevity): ${JSON.stringify(pruneDataForAI(task))}
        - Existing Decisions List: ${JSON.stringify(existingDecisions)}
        - Today's Date: ${new Date().toISOString().split('T')[0]}

        INSTRUCTIONS:
        1.  **Analyze Task Data**: Holistically review the 'Full Task Data' to understand the current state, including sub-steps, action items, and notes.
        2.  **Review Existing Decisions**: Go through each item in the 'Existing Decisions List'.
        3.  **Merge and Update**:
            *   **For each existing decision**: Check if the latest task data provides new information.
                *   If an 'undecided' item now has a clear answer in the task data, update its 'status' to 'decided', fill in the 'decision' and 'reasoning', and set the 'date'.
                *   You may also refine the 'question' or 'reasoning' of existing items if the new data provides more clarity.
                *   Keep the original 'id' for all existing items.
            *   **Identify New Decisions**: Look for any *new* critical questions or decision points in the task data that are NOT present in the existing list.
            *   For each new decision you find, create a new decision object.
        4.  **Construct Final List**: Your output MUST be a single JSON array containing the complete, merged list of decisions. This list must include:
            *   All the original decisions, updated as necessary.
            *   All the newly identified decisions.
        5.  **JSON Structure**: Every object in the output array MUST strictly follow this structure. For new items, you MUST set the 'id' field to 'NEW'. For existing items, you MUST preserve their original 'id'.
            {
              "id": "string (original ID or 'NEW' for new items)",
              "question": "The question that needs a decision.",
              "decision": "The final outcome (string, or empty string for 'undecided').",
              "reasoning": "Justification for the decision, or explanation of importance for 'undecided'.",
              "date": "YYYY-MM-DD (string, or empty string for 'undecided').",
              "status": "'decided' or 'undecided'."
            }
        6.  **Language and Format**: The output language must match the input task language. The response must be only the JSON array, without any markdown or explanations.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const decisions = parseJsonFromText<Decision[]>(response.text);
        if (!decisions || !Array.isArray(decisions) || decisions.some(d => !d.question || !d.status || !d.id)) {
            throw new Error("AI returned an unexpected format for decisions. Expected fields: id, question, status.");
        }
        return decisions;
    } catch (error) {
        handleGeminiError(error, 'decision generation');
    }
};


export const generateInitialSlideDeck = async (task: ProjectTask, projectGoal: string): Promise<SlideDeck> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
        You are a professional presentation designer and project analyst. Your task is to create a project status report slide deck based on ALL the provided data.
        CONTEXT:
        - Overall Project Goal: "${projectGoal}"
        - Full Task Data (JSON, pruned for brevity): ${JSON.stringify(pruneDataForAI(task))}
        INSTRUCTIONS:
        1.  Generate a comprehensive slide deck (5-8 slides).
        2.  The response MUST be a single, valid JSON object. Do NOT use markdown.
        3.  The JSON must follow this structure: { "slides": [ { "id": "...", "layout": "...", "isLocked": false, "elements": [ ... ] } ] }.
        4.  Available element types: 'textbox', 'image', 'table', 'chart', 'flowchart'.
        5.  For 'textbox' elements, you MUST use a "content" field for the text.
        6.  **CRITICAL SYNTHESIS**:
            - Create a title slide and an overview slide.
            - **Flowchart Slide**: If the task has sub-steps, create one slide dedicated to visualizing the workflow. This slide should have a 'textbox' title (e.g., "サブステップのワークフロー") and a 'flowchart' element. The 'flowchart' element must have this structure: \`{"id": "...", "type": "flowchart", "position": {"x": 5, "y": 15, "width": 90, "height": 75}, "data": {"subSteps": [...]}}\`. You MUST copy the entire 'subSteps' array from the input JSON into the \`data.subSteps\` field.
            - **Decision Log Slide**: If the task's 'extendedDetails.decisions' array is present and not empty, create a dedicated slide titled "決定事項ログ". Use textboxes to create a clear summary. For each 'decided' item, show the question and decision. For 'undecided' items, list the question and why it's important.
            - **ACTION ITEM FOCUS**: For significant Sub-Steps, create additional summary slides. Analyze 'actionItems' and report on completion status.
            - Create slides for key challenges and a final summary.
        7.  Write concise, professional text in the same language as the input task.
        8.  Position elements logically. Do not let them overlap.
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const deck = parseJsonFromText<SlideDeck>(response.text);
        if (!deck || !Array.isArray(deck.slides)) {
            throw new Error("AI returned an invalid format for the slide deck.");
        }
        // Validate that textboxes use 'content', not 'text'
        deck.slides.forEach(slide => {
          slide.elements.forEach(el => {
            if (el.type === 'textbox' && typeof (el as any).text !== 'undefined') {
              (el as TextboxElement).content = (el as any).text;
              delete (el as any).text;
            }
          })
        });
        return deck;
    } catch (error) {
        handleGeminiError(error, 'initial slide deck generation');
    }
};

export const regenerateSlideDeck = async (existingDeck: SlideDeck, task: ProjectTask, projectGoal: string): Promise<SlideDeck> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
      You are a presentation designer and project analyst. Your task is to update a project status report slide deck based on new data, while preserving slides that have been manually locked by the user.
      CONTEXT:
      - Overall Project Goal: "${projectGoal}"
      - Updated Full Task Data (JSON, pruned for brevity): ${JSON.stringify(pruneDataForAI(task))}
      - Existing Slide Deck (pruned for brevity): ${JSON.stringify(pruneSlideDeckForAI(existingDeck))}

      INSTRUCTIONS:
      1.  Analyze 'existingDeck'. Slides with '"isLocked": true' have been summarized and their 'elements' are empty. You MUST NOT change these slides. Return them exactly as they are in the input (id, isLocked, summary, empty elements array).
      2.  For all other slides (unlocked), REGENERATE their content from scratch based on the 'updatedTaskData'.
      3.  This includes regenerating 'flowchart' slides to reflect the latest sub-step data.
      4.  **ACTION ITEM FOCUS**: When regenerating, pay close attention to the progress and reports within each sub-step's 'actionItems'.
      5.  The final output MUST be a single, valid JSON object representing the complete slide deck, with all slides (locked and regenerated) in their original order.
      6.  Follow the same JSON structure and rules as the initial generation.
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const deck = parseJsonFromText<SlideDeck>(response.text);
        if (!deck || !Array.isArray(deck.slides)) {
            throw new Error("AI returned an invalid format for the regenerated slide deck.");
        }
        return deck;
    } catch (error) {
        handleGeminiError(error, 'slide deck regeneration');
    }
};


export const optimizeSlideLayout = async (deck: SlideDeck): Promise<SlideDeck> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
        You are an expert presentation designer. The following JSON represents a slide deck.
        Analyze its content and structure. Your task is to improve the layout, wording, and visual hierarchy for maximum clarity and impact.
        You can rephrase text for conciseness, change element positions and sizes, and adjust font properties. Do not change element types or IDs.
        Return the updated slide deck as a valid JSON object with the exact same structure as the input. Do not use markdown.
        CRITICAL: Textbox elements use a "content" field, NOT a "text" field.
        
        Input Deck (pruned for brevity):
        ${JSON.stringify(pruneSlideDeckForAI(deck))}
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const optimizedDeck = parseJsonFromText<SlideDeck>(response.text);
        if (!optimizedDeck || !Array.isArray(optimizedDeck.slides)) {
            throw new Error("AI returned an invalid format for the optimized slide deck.");
        }
        return optimizedDeck;
    } catch (error) {
        handleGeminiError(error, 'slide layout optimization');
    }
};

export const generateProjectHealthReport = async (tasks: ProjectTask[], projectGoal: string, targetDate: string): Promise<ProjectHealthReport> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
      You are a senior project manager AI. Your task is to conduct a holistic health check of the entire project.
      CONTEXT:
      - Overall Project Goal: "${projectGoal}"
      - Final Target Date: "${targetDate}"
      - Current Date: "${new Date().toISOString().split('T')[0]}"
      - Full Project Data (JSON, pruned for brevity): ${JSON.stringify(pruneDataForAI(tasks), null, 2)}

      INSTRUCTIONS:
      1.  **Holistic Analysis**: Review ALL provided data. Compare task/sub-step due dates with the current date. Analyze dependencies, blockers, and the completion rate of action items.
      2.  **Determine Overall Status**: Categorize the project's health as 'On Track', 'At Risk', or 'Off Track'.
      3.  **Identify Positives**: List 2-3 key accomplishments or areas that are progressing well.
      4.  **Identify Concerns**: List the most critical risks or issues. For each, explain WHY it's a concern (e.g., "Task 'X' is 2 weeks overdue and blocking 3 other tasks"). Note the related task IDs.
      5.  **Propose Solutions**: For each major concern, provide concrete, actionable suggestions for improvement. (e.g., "Re-allocate resources from Task Y to Task X", "Hold a risk mitigation meeting for Z").
      6.  **Summarize**: Write a concise, executive-level summary of the project's current state.
      7.  **JSON Output**: Your response MUST be a single, valid JSON object following the ProjectHealthReport structure. Do not include markdown or explanations.
      8.  **The output language MUST be Japanese.**

      JSON Structure to follow:
      {
        "overallStatus": "'On Track' | 'At Risk' | 'Off Track'",
        "summary": "string",
        "positivePoints": ["string"],
        "areasOfConcern": [{ "description": "string", "relatedTaskIds": ["string"] }],
        "suggestions": ["string"]
      }
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const report = parseJsonFromText<ProjectHealthReport>(response.text);
        if (!report || !report.overallStatus || !report.summary) {
            throw new Error("AI returned an invalid format for the project health report.");
        }
        return report;
    } catch (error) {
        handleGeminiError(error, 'project health report generation');
    }
};

export const generateProjectReportDeck = async (tasks: ProjectTask[], projectGoal: string, targetDate: string): Promise<SlideDeck> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
        You are a senior project analyst AI. Your task is to create a comprehensive slide deck summarizing the ENTIRE project status.
        CONTEXT:
        - Overall Project Goal: "${projectGoal}"
        - Final Target Date: "${targetDate}"
        - Full Project Data (JSON, pruned for brevity): ${JSON.stringify(pruneDataForAI(tasks), null, 2)}
        INSTRUCTIONS:
        1.  Synthesize a comprehensive slide deck (6-10 slides) summarizing the entire project.
        2.  The response MUST be a single, valid JSON object following the SlideDeck structure. Do NOT use markdown.
        3.  The output language MUST be Japanese.
        4.  **CRITICAL SYNTHESIS**:
            - **Title & Overview**: Create a title slide and a project overview slide.
            - **Task Summary & Flowchart**: For each major task in the 'tasks' array, create one or two summary slides. One slide should show a \`flowchart\` of its sub-steps if they exist, following the structure \`{"type": "flowchart", "data": {"subSteps": [...]}}\`. You MUST copy the task's specific \`subSteps\` array from the input JSON into the \`data.subSteps\` field. Another slide can summarize the task's status and outcomes.
            - **Key Project Decisions**: Analyze the 'decisions' data from all tasks. Create a dedicated slide titled "主要なプロジェクト決定事項". List the top 3-5 most important 'decided' items and their outcomes. Separately, list any critical 'undecided' questions that pose a risk to the project timeline or goals.
            - **Key Achievements & Risks**: Create dedicated slides for significant achievements and project-level risks.
            - **Conclusion**: A final slide summarizing the project's outlook and next steps.
        5.  Use the standard JSON format for slides and elements. Remember "content" for textboxes.
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const deck = parseJsonFromText<SlideDeck>(response.text);
        if (!deck || !Array.isArray(deck.slides)) {
            throw new Error("AI returned an invalid format for the project slide deck.");
        }
        return deck;
    } catch (error) {
        handleGeminiError(error, 'project report deck generation');
    }
};


export const regenerateProjectReportDeck = async (existingDeck: SlideDeck, tasks: ProjectTask[], projectGoal: string, targetDate: string): Promise<SlideDeck> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
      You are a senior project analyst AI. Your task is to update a project-wide status report slide deck based on new data, while preserving slides that have been manually locked by the user.
      CONTEXT:
      - Overall Project Goal: "${projectGoal}"
      - Final Target Date: "${targetDate}"
      - Updated Full Project Data (JSON, pruned for brevity): ${JSON.stringify(pruneDataForAI(tasks), null, 2)}
      - Existing Slide Deck (pruned for brevity): ${JSON.stringify(pruneSlideDeckForAI(existingDeck))}

      INSTRUCTIONS:
      1.  Analyze 'existingDeck'. Slides with '"isLocked": true' have been summarized and their 'elements' are empty. You MUST NOT change these slides. Return them exactly as they are in the input (id, isLocked, summary, empty elements array).
      2.  For all other slides (unlocked slides), REGENERATE their content from scratch based on the updated project data.
      3.  This includes regenerating any 'flowchart' elements on unlocked slides to show the latest sub-step data.
      4.  Synthesize information across all tasks to provide a holistic project view in the regenerated slides.
      5.  The final output MUST be a single, valid JSON object for the complete slide deck, in the original slide order.
      6.  The output language MUST be Japanese.
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const deck = parseJsonFromText<SlideDeck>(response.text);
        if (!deck || !Array.isArray(deck.slides)) {
            throw new Error("AI returned an invalid format for the regenerated project slide deck.");
        }
        return deck;
    } catch (error) {
        handleGeminiError(error, 'project report deck regeneration');
    }
};

// --- NEW CUSTOM REPORT GENERATOR ---

// Helper to get base64 data from dataUrl
const getBase64FromDataUrl = (dataUrl: string): { mimeType: string; data: string } | null => {
    const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
};

export interface CustomSource {
  name: string;
  type: 'json' | 'image' | 'text';
  content: any;
}

const buildSourceParts = (sources: CustomSource[]): any[] => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const parts: any[] = [];
    for (const source of sources) {
        parts.push({ text: `\n--- START OF SOURCE: ${source.name} ---\n` });
        if (source.type === 'image' && typeof source.content === 'string') {
            const imageData = getBase64FromDataUrl(source.content);
            if (imageData) {
                parts.push({
                    inlineData: {
                        mimeType: imageData.mimeType,
                        data: imageData.data,
                    },
                });
            } else {
                 parts.push({ text: "[Image data was invalid or in wrong format]" });
            }
        } else if (source.type === 'json') {
            const prunedData = source.content.slides ? pruneSlideDeckForAI(source.content) : pruneDataForAI(source.content);
            parts.push({ text: `Type: JSON Data\nContent: ${JSON.stringify(prunedData, null, 2)}` });
        } else {
             parts.push({ text: `Type: Text\nContent: ${source.content}` });
        }
        parts.push({ text: `\n--- END OF SOURCE: ${source.name} ---\n` });
    }
    return parts;
};

export const generateCustomSlideDeck = async (sources: CustomSource[], userPrompt: string): Promise<SlideDeck> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const promptHeader = `
        You are a professional presentation designer AI. Your task is to create a slide deck based on a user's objective and provided source materials.

        **USER OBJECTIVE**: "${userPrompt}"

        **CRITICAL INSTRUCTIONS**:
        1.  **Strict JSON Output**: Your entire response MUST be a single, valid JSON object. Do NOT include any text, explanations, or markdown fences (like \`\`\`json\`) outside of the JSON object. Your response should start with \`{\` and end with \`}\`.
        2.  **Schema Adherence**: The JSON object MUST strictly conform to the following TypeScript interfaces for \`SlideDeck\`, \`Slide\`, and \`SlideElement\`.
            \`\`\`typescript
            // The main container for the presentation
            interface SlideDeck {
              slides: Slide[];
              theme?: 'light' | 'dark' | 'business';
            }

            // Represents a single slide in the deck
            interface Slide {
              id: string; // A unique identifier for the slide
              layout: 'title_slide' | 'title_and_content' | 'section_header' | 'two_column' | 'blank';
              elements: SlideElement[];
              isLocked?: boolean; // Must be false for all generated slides
              notes?: string; // Optional speaker notes
            }

            // Union type for all possible elements on a slide
            type SlideElement = TextboxElement | ImageElement | TableElement | ChartElement | FlowchartElement;

            // Base interface for all elements
            interface BaseSlideElement {
              id: string; // A unique identifier for the element
              type: 'textbox' | 'image' | 'table' | 'chart' | 'flowchart';
              position: { x: number; y: number; width: number; height: number; }; // Position in percentages
            }

            // For displaying text
            interface TextboxElement extends BaseSlideElement {
              type: 'textbox';
              content: string; // IMPORTANT: The text content field MUST be named "content".
            }
            
            // For displaying an image from the source materials
            interface ImageElement extends BaseSlideElement {
              type: 'image';
              // You MUST find a relevant image from the source materials and reference its properties here.
              // These IDs must correspond to actual data in the sources provided.
              subStepId: string;
              actionItemId: string; 
              attachmentId: string;
            }

            // For displaying a flowchart of sub-steps
            interface FlowchartElement extends BaseSlideElement {
                type: 'flowchart';
                // You MUST copy the entire 'subSteps' array from the source task data into this field.
                data: {
                    subSteps: any[]; 
                };
            }
            \`\`\`
        3.  **Content Synthesis**:
            *   Analyze ALL provided source materials to create a coherent 4-7 slide presentation that directly addresses the user's objective.
            *   If image sources are provided, you MUST incorporate them into the slides using the 'image' element type.
            *   Do not just copy-paste. Interpret, summarize, and visualize the information effectively.
        4.  **Language**: The output language MUST be Japanese.
        5.  **IDs**: Generate unique string IDs for all 'id' fields in slides and elements.

        **SOURCE MATERIALS FOLLOW**:
    `;

    const parts: any[] = [{ text: promptHeader }, ...buildSourceParts(sources)];    
    parts.push({ text: `\nReminder: Create the slide deck now based on the objective and all the sources provided above. The response must be only the JSON object.`});

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT,
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });

        const deck = parseJsonFromText<SlideDeck>(response.text);
        if (!deck || !Array.isArray(deck.slides)) {
            throw new Error("AI returned an invalid format for the custom slide deck.");
        }
        return deck;
    } catch (error) {
        handleGeminiError(error, 'custom slide deck generation');
    }
};


export const generateCustomTextReport = async (sources: CustomSource[], userPrompt: string): Promise<string> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const promptHeader = `
        You are an expert project analyst. Your task is to write a text-based report based on a specific user objective and a collection of source materials.
        USER OBJECTIVE:
        "${userPrompt}"
        INSTRUCTIONS:
        1.  Synthesize the information from ALL provided source materials to create a coherent and insightful report that directly addresses the user's objective.
        2.  Do not simply copy-paste data. Interpret and summarize the information in a clear, professional manner.
        3.  Format the output using Markdown for readability (e.g., use headings, bullet points, bold text).
        4.  If image sources are provided, reference them by name in your report (e.g., "(see image: 'chart.png')"). Do not try to embed them.
        5.  The language of the output should be Japanese.
        6.  Your response MUST be only the text report. Do not include any other explanations.
        SOURCE MATERIALS FOLLOW:
    `;

    const parts: any[] = [{ text: promptHeader }, ...buildSourceParts(sources)];
    parts.push({ text: `\nReminder: Write the report now based on the objective and all the sources provided above. The response must be only the text report.`});
    
    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT,
            contents: { parts },
        });
        return response.text;
    } catch (error) {
        handleGeminiError(error, 'custom text report generation');
    }
};


export const generateGanttData = async (tasks: ProjectTask[], projectGoal: string, targetDate: string): Promise<GanttItem[]> => {
    if (!ai) throw new Error("AI Service not initialized. Please set an API Key.");
    const prompt = `
      You are a project management assistant AI. Your task is to convert a project structure into data for a Gantt chart.
      CONTEXT:
      - Project Goal: "${projectGoal}"
      - Project Start Date: "${new Date().toISOString().split('T')[0]}"
      - Project Target End Date: "${targetDate}"
      - Full Project Data (JSON, pruned for brevity): ${JSON.stringify(pruneDataForAI(tasks), null, 2)}

      INSTRUCTIONS:
      1.  Create a flat list of items for the Gantt chart. Include every ProjectTask, every SubStep, and every ActionItem from all tasks.
      2.  For each item, generate a JSON object with this exact structure:
          { "id": "string", "name": "string", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "progress": number, "dependencies": ["string"], "type": "'task' | 'substep' | 'actionitem'", "parentId": "string | null" }
      3.  **Date Estimation**:
          - The project must fit between the start and target dates.
          - Use an item's \`dueDate\` as its 'end' date if available for tasks and sub-steps.
          - Estimate 'start' and 'end' dates logically. An item must start after its dependencies end.
          - For 'actionitem', estimate a short duration (e.g., 1-2 days) within the parent sub-step's timeframe.
      4.  **Progress Calculation**:
          - For a 'task': 'Completed' is 100, 'Not Started' is 0. For 'In Progress' or 'Blocked', average the progress of its sub-steps. If no sub-steps, 'In Progress' is 50.
          - For a 'substep': Calculate progress from its \`actionItems\` (% of completed items). If no action items, use its \`status\`: 'Completed' is 100, 'In Progress' is 50, 'Not Started' is 0.
          - For an 'actionitem': 'completed: true' is 100, 'completed: false' is 0.
      5.  **Dependencies & Parent ID**:
          - **Rule**: The 'dependencies' array models the sequential workflow. A dependency can ONLY exist between items of the SAME \`type\` AND with the SAME \`parentId\`.
          - **Tasks**: A task's 'parentId' is ALWAYS null. Use \`nextTaskIds\` to establish dependencies between tasks.
          - **Sub-steps**: A sub-step's 'parentId' MUST BE the ID of its parent ProjectTask. Use \`nextSubStepIds\` to establish dependencies ONLY between sub-steps within the same task.
          - **Action Items**: An action item's 'parentId' MUST BE the ID of its parent SubStep. Create sequential dependencies ONLY between action items within the same sub-step (item 2 depends on item 1, etc.).
          - **CRITICAL**: Do NOT create dependencies across different parents (e.g., from a sub-step in Task A to one in Task B) or across different types (e.g., from a task to a sub-step).
      6.  Your response MUST be a single, valid JSON array of GanttItem objects. Do not use markdown.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_TEXT, contents: prompt, config: { responseMimeType: "application/json" },
        });
        const ganttData = parseJsonFromText<GanttItem[]>(response.text);
        if (!ganttData || !Array.isArray(ganttData)) {
            throw new Error("AI returned an invalid format for the Gantt chart data.");
        }
        return ganttData;
    } catch (error) {
        handleGeminiError(error, 'Gantt chart data generation');
    }
};
