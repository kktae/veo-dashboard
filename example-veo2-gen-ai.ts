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

async function generateVideo(prompt: string, outputGcsUri?: string) {
  console.log("outputGcsUri:", outputGcsUri);
  console.log('Generating video...');
  let operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt: prompt,
    config: {
      aspectRatio: '16:9',
      numberOfVideos: 1,
      durationSeconds: 8,
      enhancePrompt: true,
      generateAudio: false,
      outputGcsUri: outputGcsUri,
      personGeneration: PersonGeneration.ALLOW_ALL,
    }
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

// const videos = await generateVideo('A man is walking down the street', process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI);
// console.log(videos);