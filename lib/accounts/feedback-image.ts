import sharpRuntime from 'sharp';

type FeedbackImagePipeline = {
  metadata(): Promise<{ format?: string; pages?: number; width?: number; height?: number }>;
  rotate(): FeedbackImagePipeline;
  resize(options: { width: number; height: number; fit: 'inside'; withoutEnlargement: boolean }): FeedbackImagePipeline;
  webp(options: { quality: number }): FeedbackImagePipeline;
  timeout(options: { seconds: number }): FeedbackImagePipeline;
  toBuffer(): Promise<Buffer>;
};

type FeedbackImageFactory = {
  (input: Buffer, options: { failOn: 'warning'; limitInputPixels: number; limitInputChannels: number }): FeedbackImagePipeline;
  cache(options: { memory: number; files: number; items: number }): unknown;
  concurrency(value: number): number;
};

// vinext ships a compatibility declaration that types optional sharp as
// unknown. This narrow adapter describes only the API the feedback path uses.
export const feedbackImage = sharpRuntime as FeedbackImageFactory;
feedbackImage.cache({ memory: 8, files: 0, items: 8 });
feedbackImage.concurrency(1);
