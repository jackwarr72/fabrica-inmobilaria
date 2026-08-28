import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const propertyCount = await prisma.opportunity.count();
    const contactCount = await prisma.contact.count();
    const appointmentCount = await prisma.appointment.count();

    return NextResponse.json({
      success: true,
      data: {
        propertiesCaptured: propertyCount,
        activeContacts: contactCount,
        scheduledAppointments: appointmentCount,
        targetZone: 'Toluca-Metepec',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch operational metrics' },
      { status: 500 }
    );
  }
}