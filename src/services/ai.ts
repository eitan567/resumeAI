import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateResume = async (
  jobTitle: string,
  skills: string,
  experience: string,
  education: string,
  template: string = 'modern',
  personalLink?: string
): Promise<string> => {
  let templateInstructions = '';
  if (template === 'modern') {
    templateInstructions = 'Use a clean, standard professional format with clear headings and bullet points. Keep the tone objective and professional.';
  } else if (template === 'creative') {
    templateInstructions = 'Use a modern, creative format. You can use appropriate emojis for section headers and write in a slightly more engaging, dynamic tone.';
  } else if (template === 'executive') {
    templateInstructions = 'Use a highly formal, executive format. Focus heavily on leadership, quantifiable achievements, and strategic impact. Keep the tone authoritative and concise.';
  }

  const prompt = `
    You are an expert resume writer. Create a professional, high-impact resume in Hebrew based on the following details:
    Job Title: ${jobTitle}
    Skills: ${skills}
    Experience: ${experience}
    Education: ${education}
    ${personalLink ? `Personal Profile Link: ${personalLink}` : ''}
    
    Format the output in clear Markdown. 
    CRITICAL INSTRUCTIONS:
    1. Include a "Summary" (תמצית מקצועית) section that is engaging and highlights key strengths.
    2. Include an "Experience" (ניסיון תעסוקתי) section with clear dates, company names, and bullet points for achievements.
    3. Include an "Education" (השכלה) section.
    4. Include a "Skills" (כישורים ומיומנויות) section.
    5. ${personalLink ? `IMPORTANT: Include the Personal Profile Link (${personalLink}) prominently at the very top under the name/title or in a dedicated "Contact Information" (פרטי התקשרות) section.` : ''}
    6. Use professional Hebrew terminology suitable for the Israeli high-tech and corporate sectors.
    7. Do not include a "Name" header in the markdown, as it will be added by the UI.
    
    TEMPLATE STYLE:
    ${templateInstructions}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || '';
};

export const generateCoverLetter = async (
  jobTitle: string,
  companyName: string,
  skills: string,
  experience: string,
  template: string = 'formal'
): Promise<string> => {
  let templateInstructions = '';
  if (template === 'formal') {
    templateInstructions = 'Use a highly formal, respectful, and traditional corporate tone. Focus on professionalism, reliability, and structured communication.';
  } else if (template === 'startup') {
    templateInstructions = 'Use a dynamic, enthusiastic, and modern tone suitable for a tech startup. Emphasize passion, adaptability, and a "can-do" attitude. Keep it relatively concise and engaging.';
  } else if (template === 'creative') {
    templateInstructions = 'Use a creative, out-of-the-box, and highly engaging tone. Suitable for design, marketing, or creative roles. You can use a slightly more personal voice to stand out.';
  }

  const prompt = `
    You are an expert career coach. Write a professional cover letter in Hebrew for the position of ${jobTitle} at ${companyName}.
    Use the following applicant details:
    Skills: ${skills}
    Experience: ${experience}
    
    Format the output in clear Markdown. Make it persuasive and tailored for the Israeli job market.
    
    TONE AND STYLE INSTRUCTIONS:
    ${templateInstructions}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || '';
};

export const rewriteDocument = async (
  content: string,
  type: 'resume' | 'cover_letter',
  newTemplate: string
): Promise<string> => {
  let templateInstructions = '';
  if (type === 'resume') {
    if (newTemplate === 'modern') {
      templateInstructions = 'Use a clean, standard professional format with clear headings and bullet points. Keep the tone objective and professional.';
    } else if (newTemplate === 'creative') {
      templateInstructions = 'Use a modern, creative format. You can use appropriate emojis for section headers and write in a slightly more engaging, dynamic tone.';
    } else if (newTemplate === 'executive') {
      templateInstructions = 'Use a highly formal, executive format. Focus heavily on leadership, quantifiable achievements, and strategic impact. Keep the tone authoritative and concise.';
    }
  } else {
    if (newTemplate === 'formal') {
      templateInstructions = 'Use a highly formal, respectful, and traditional corporate tone. Focus on professionalism, reliability, and structured communication.';
    } else if (newTemplate === 'startup') {
      templateInstructions = 'Use a dynamic, enthusiastic, and modern tone suitable for a tech startup. Emphasize passion, adaptability, and a "can-do" attitude. Keep it relatively concise and engaging.';
    } else if (newTemplate === 'creative') {
      templateInstructions = 'Use a creative, out-of-the-box, and highly engaging tone. Suitable for design, marketing, or creative roles. You can use a slightly more personal voice to stand out.';
    }
  }

  const prompt = `
    You are an expert career coach and resume writer. Rewrite the following Hebrew ${type === 'resume' ? 'resume' : 'cover letter'} according to the new template instructions.
    
    ORIGINAL CONTENT:
    ${content}
    
    NEW TEMPLATE INSTRUCTIONS:
    ${templateInstructions}
    
    Format the output in clear Markdown. Keep all the factual information (experience, education, skills) intact, but change the tone, structure, and formatting to match the new template instructions.
    Ensure the output is in Hebrew.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || '';
};
