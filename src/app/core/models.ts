export type ProjectType = 'CREATIVE' | 'CAREER';

export interface Profile {
  name: string;
  headline: string;
  about: string;
  location: string;
  resumeUrl: string;
}

export interface Project {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  type: ProjectType;
  category: string;
  thumbnailUrl: string;
  externalUrl: string;
  videoUrl: string;
  featured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  name: string;
  category: string;
  proficiency: string;
  displayOrder: number;
}

export interface Education {
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Experience {
  organization: string;
  role: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  currentRole: boolean;
  description: string;
}

export interface SocialLink {
  platform: string;
  label: string;
  url: string;
  section: string;
  displayOrder: number;
}

export interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactResponse {
  status: string;
  message: string;
}

export interface FieldError {
  field: string;
  message: string;
}
