'use strict';

// Resume content is independent of movement, house layout, and panel rendering.
const RESUME_SECTIONS = {
  about: {
    title: 'Curious by nature.',
    intro: "I'm Anush Lobo, a full stack developer based in Mangalore, India. I like turning complex problems into clear, useful experiences.",
    blocks: [{
      title: 'A little about me',
      description: "With hands-on experience across the MERN and Java/Spring stacks, I enjoy building the parts users see and the reliable systems they don't. I care about clean architecture, thoughtful UX, and code that is ready for the real world.",
      tags: ['6 months internship experience', '3 featured projects', 'Current CGPA: 8.86'],
    }],
  },
  skills: {
    title: 'Tools for the long haul.',
    intro: 'I choose the tool that lets the idea travel furthest.',
    blocks: [
      { title: 'Languages & frameworks', tags: ['Java', 'JavaScript', 'TypeScript', 'Go', 'Python', 'React', 'Node.js', 'Express', 'Spring Boot'] },
      { title: 'Data & real-time', tags: ['MongoDB', 'MySQL', 'Redis', 'SQLite', 'Socket.IO', 'JWT', 'Google OAuth'] },
      { title: 'Quality & workflow', tags: ['Jest', 'Vitest', 'Postman', 'Swagger', 'Git / GitHub', 'Maven', 'Jira', 'Agile / Scrum'] },
      { title: 'Special interests', tags: ['REST API design', 'Machine learning', 'Deep learning', 'OpenCV', 'MediaPipe', 'Tailwind CSS'] },
    ],
  },
  projects: {
    title: 'Made to be experienced.',
    intro: 'Three builds. Three different ways to make technology feel human.',
    blocks: [
      {
        title: 'VidStudio',
        meta: 'December 2025 — January 2026',
        description: 'A focused portfolio and video production experience for showcasing creative work, with a filterable gallery, modal playback, and a visual language that lets the work stay in the spotlight.',
        tags: ['React', 'JavaScript', 'Node.js', 'MongoDB', 'Tailwind CSS'],
      },
      {
        title: 'FocusTrack',
        meta: 'June — July 2025',
        description: 'An AI-powered student monitoring system that combines detection, recognition, attendance, attention analysis, and reporting in one clear workflow.',
        tags: ['Python', 'OpenCV', 'MediaPipe', 'Machine learning', 'React'],
      },
      {
        title: 'LeapMentor',
        meta: 'Nineleaps',
        description: 'A full-stack EdTech mentorship platform connecting learners and mentors through discovery, verification, communication, booking, payments, and admin operations.',
        tags: ['React', 'Node.js', 'MongoDB', 'Redis', 'Socket.IO', 'Jest'],
      },
    ],
  },
  experience: {
    title: 'Shipping with the team.',
    intro: 'A place where ideas become features, together.',
    blocks: [{
      title: 'Nineleaps — Trainee Full Stack Engineer',
      meta: 'March — July 2026 · Bengaluru, India',
      description: 'On a 5-person Agile team, I helped shape LeapMentor, an EdTech platform for mentor discovery, session booking, payments, and admin workflows.',
      items: [
        'Built the real-time Socket.IO notification layer and instant toast updates.',
        'Delivered authentication, forgot-password, user management, mentor verification, and admin settings.',
        'Added Redis caching, centralized error handling, and Jest/Vitest coverage before release.',
      ],
      tags: ['React', 'Node.js', 'MongoDB', 'Redis', 'Socket.IO'],
    }],
  },
  education: {
    title: 'Still learning. Always.',
    intro: 'The road is more interesting when you keep asking why.',
    blocks: [
      { title: 'St Joseph Engineering College', meta: '2022 — 2026 · Mangalore, Karnataka', description: 'B.E. in Artificial Intelligence & Machine Learning', tags: ['CGPA: 8.86'] },
      { title: 'Jain Pre-University College', meta: '2020 — 2022 · Moodbidri, Karnataka', description: '12th — PCMC', tags: ['92.50%'] },
      { title: 'St Ignatius English Medium School', meta: '2019 — 2020 · Paladka, Karnataka', description: '10th standard', tags: ['93.92%'] },
    ],
  },
  contact: {
    title: 'Got a road in mind?',
    intro: "I'm always open to a good conversation, a tricky problem, or a team building something that matters.",
    links: [
      { label: 'Email', text: 'loboanush78@gmail.com', href: 'mailto:loboanush78@gmail.com' },
      { label: 'Phone', text: '+91 85488 13708', href: 'tel:+918548813708' },
      { label: 'GitHub', text: 'github.com/Anushlobo', href: 'https://github.com/Anushlobo' },
      { label: 'LinkedIn', text: 'linkedin.com/in/anush-lobo', href: 'https://linkedin.com/in/anush-lobo' },
    ],
  },
};
