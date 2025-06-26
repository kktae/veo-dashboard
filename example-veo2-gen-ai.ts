import { GenerateContentConfig, GoogleGenAI, HarmCategory, HarmBlockThreshold, PersonGeneration } from '@google/genai';

const ai = new GoogleGenAI(
  {
    vertexai: process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION,
  }
);

async function generateText(prompt: string) {
  console.log("Generating text...");
  console.log("prompt:", prompt);
  const generationConfig: GenerateContentConfig = {
    maxOutputTokens: 1024,
    temperature: 0.4,
    topP: 0.95,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.OFF,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.OFF,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.OFF,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.OFF,
      }
    ],
    systemInstruction: {
      parts: [{"text": `You are a professional translator.`}]
    },
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite-001',
    contents: [
      {
        role: 'user',
        parts: [{"text": `Please translate the following Korean text into English: ${prompt}`}]
      }
    ],
    config: generationConfig  
  });
  console.log("Text generated");
  return response.text;
}

async function generateVideo(
  prompt: string, 
  outputGcsUri?: string, 
  model: string = 'veo-3.0-generate-preview',
  enhancePrompt: boolean = true,
  generateAudio: boolean = false,
  negativePrompt: string = ''
) {
  console.log("outputGcsUri:", outputGcsUri);
  console.log("model:", model);
  console.log("enhancePrompt:", enhancePrompt);
  console.log("generateAudio:", generateAudio);
  console.log("negativePrompt:", negativePrompt || "none");
  console.log('Generating video...');
  
  const videoConfig: any = {
    aspectRatio: '16:9',
    numberOfVideos: 1,
    durationSeconds: 8,
    enhancePrompt: enhancePrompt,
    generateAudio: generateAudio,
    outputGcsUri: outputGcsUri,
    personGeneration: PersonGeneration.ALLOW_ALL,
  };

  // Add negative prompt only if provided
  if (negativePrompt && negativePrompt.trim()) {
    videoConfig.negativePrompt = negativePrompt.trim();
  }

  let operation = await ai.models.generateVideos({
    model: model,
    prompt: prompt,
    config: videoConfig
  });

  while (!operation.done) {
    console.log("Waiting for operation to complete...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos generated');
  }

  videos.forEach((video, i) => {
    ai.files.download({
      file: video,
      downloadPath: `video${i}.mp4`,
    });
    console.log('Downloaded video', `video${i}.mp4`);
  });
  console.log("Videos generated");
  return videos;
}

const text = await generateText('여우가 웃고 있습니다.');
console.log("result:", text);

// Examples of using different Veo models with various parameters
// Using Veo 3.0 with default settings
// const videos = await generateVideo('A man is walking down the street', process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI);

// Using Veo 3.0 with audio generation
// const videos = await generateVideo('A man is walking down the street', process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI, 'veo-3.0-generate-preview', true, true);

// Using Veo 3.0 with negative prompt
// const videos = await generateVideo('A beautiful forest', process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI, 'veo-3.0-generate-preview', true, false, 'dark, scary, horror');

// Using Veo 2.0 with custom settings
// const videos = await generateVideo('A man is walking down the street', process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI, 'veo-2.0-generate-001', false, true, 'blurry, low quality');

// console.log(videos);