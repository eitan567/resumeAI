import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateResume = async (
  jobTitle: string,
  skills: string,
  experience: string,
  education: string,
  template: string = 'modern'
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
    You are an expert resume writer. Create a professional resume in Hebrew based on the following details:
    Job Title: ${jobTitle}
    Skills: ${skills}
    Experience: ${experience}
    Education: ${education}
    
    Format the output in clear Markdown. Include sections for Summary, Experience, Education, and Skills.
    Make it sound professional, impactful, and tailored for the Israeli job market.
    
    TEMPLATE INSTRUCTIONS:
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
