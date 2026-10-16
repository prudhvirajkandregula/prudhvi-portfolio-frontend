import { Routes } from '@angular/router';

import { Home } from './pages/home/home';
import { Creative } from './pages/creative/creative';
import { Career } from './pages/career/career';
import { ProjectDetail } from './pages/project-detail/project-detail';
import { Contact } from './pages/contact/contact';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    pathMatch: 'full',
    data: {
      title: 'Kandregula Prudhvi Raj — Creative & Developer',
      themeColor: '#f7f6f3',
    },
  },
  {
    path: 'creative',
    component: Creative,
    data: { title: 'Creative — Prudhvi', themeColor: '#0b0b0d' },
  },
  {
    path: 'career',
    component: Career,
    data: { title: 'Career — Prudhvi', themeColor: '#0b0b0d' },
  },
  {
    path: 'projects/:slug',
    component: ProjectDetail,
    data: { title: 'Project — Prudhvi', themeColor: '#0b0b0d' },
  },
  {
    path: 'contact',
    component: Contact,
    data: { title: 'Contact — Prudhvi', themeColor: '#0b0b0d' },
  },
  {
    path: '**',
    redirectTo: '',
  },
];
