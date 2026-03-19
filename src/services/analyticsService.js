/**
 * Analytics service — агрегирует данные для /stats.
 */
import * as analyticsRepo from '../repositories/analyticsRepository.js';
import * as userRepo from '../repositories/userRepository.js';

export function getSummary() {
  const dauToday = analyticsRepo.getDAU();
  const conversion = analyticsRepo.getConversion('start', 'template_complete');
  const ctr = analyticsRepo.getButtonCTR();
  const retention = analyticsRepo.getRetention();
  const totalUsers = userRepo.count();
  const all = analyticsRepo.getAll();
  const templatesDone = all.filter((e) => e.event === 'template_complete').length;

  return { dauToday, conversion, ctr, retention, totalUsers, templatesDone };
}

export function getDAUHistory(days = 7) {
  return analyticsRepo.getDAUHistory(days);
}
