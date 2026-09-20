import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

def create_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = colors.HexColor("#0F172A")    # Dark Navy
    SECONDARY = colors.HexColor("#2563EB")  # Electric Blue
    ACCENT = colors.HexColor("#0D9488")     # Teal
    DARK_TEXT = colors.HexColor("#1E293B")  # Charcoal
    LIGHT_BG = colors.HexColor("#F8FAFC")   # Light Slate
    BORDER_COLOR = colors.HexColor("#E2E8F0")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY,
        alignment=TA_LEFT,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=17,
        textColor=SECONDARY,
        alignment=TA_LEFT,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=PRIMARY,
        spaceBefore=14,
        spaceAfter=8
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=SECONDARY,
        spaceBefore=10,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14.5,
        textColor=DARK_TEXT,
        alignment=TA_LEFT,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=DARK_TEXT
    )

    story = []

    # Title & Subtitle Header
    story.append(Paragraph("Train AI — Platform & Operational Guide", title_style))
    story.append(Paragraph("A Plain-English Overview of How the App Works, Business Operations &amp; Payment Flows", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=SECONDARY, spaceBefore=0, spaceAfter=15))

    # Executive Summary Box
    summary_text = (
        "<b>Executive Summary:</b> Train AI is an all-in-one digital training, learning, and workforce development platform. "
        "It connects three groups of people: <b>Learners</b> (who take courses and build skills), <b>Organizations/Businesses</b> "
        "(who train their staff and track performance), and <b>Instructors</b> (who create courses and teach). "
        "This document explains how the entire platform operates without using technical programming jargon."
    )
    summary_table = Table([[Paragraph(summary_text, callout_style)]], colWidths=[530])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, SECONDARY),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # SECTION 1: HOW THE APP WORKS AT LARGE
    story.append(Paragraph("1. How the App Works at Large (The 3 Workspaces)", h1_style))
    story.append(Paragraph(
        "Train AI is structured into three dedicated areas so every user has exactly the tools they need:",
        body_style
    ))

    ws_data = [
        [
            Paragraph("<b>Workspace</b>", ParagraphStyle('TH', parent=body_style, fontName='Helvetica-Bold', textColor=colors.white)),
            Paragraph("<b>Who Uses It</b>", ParagraphStyle('TH', parent=body_style, fontName='Helvetica-Bold', textColor=colors.white)),
            Paragraph("<b>What They Do Here</b>", ParagraphStyle('TH', parent=body_style, fontName='Helvetica-Bold', textColor=colors.white))
        ],
        [
            Paragraph("<b>Learner Workspace</b>", body_style),
            Paragraph("Employees, Students, Individual Learners", body_style),
            Paragraph("Take interactive courses, practice quizzes, chat with the AI Learning Assistant, join study groups, and earn verified completion certificates.", body_style)
        ],
        [
            Paragraph("<b>Organization Workspace</b>", body_style),
            Paragraph("Company Executives, Managers, HR, Instructors", body_style),
            Paragraph("Manage team members, purchase employee seats, assign courses, set role permissions, track skill analytics, and handle company billing.", body_style)
        ],
        [
            Paragraph("<b>Platform Owner Portal</b>", body_style),
            Paragraph("Train AI Platform Administrators", body_style),
            Paragraph("Oversee overall platform health, manage company subscription plans, monitor global payments, and set system-wide preferences.", body_style)
        ]
    ]
    ws_table = Table(ws_data, colWidths=[130, 140, 260])
    ws_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(ws_table)
    story.append(Spacer(1, 14))

    # SECTION 2: THE B2B (BUSINESS-TO-BUSINESS) FLOW
    story.append(Paragraph("2. The B2B (Business-to-Business) Journey", h1_style))
    story.append(Paragraph(
        "When a business or institution uses Train AI to train its workforce, the process follows these clear steps:",
        body_style
    ))

    b2b_steps = [
        ("Step 1: Company Registration", "A company signs up on Train AI, creates their official company profile, and establishes their company domain."),
        ("Step 2: Subscription Plan Selection", "The company chooses a plan based on their team size — <b>Starter</b> (for smaller teams) or <b>Growth</b> (for growing enterprises). This activates their business workspace."),
        ("Step 3: Purchasing Learner Seats", "Train AI uses a simple <b>Seat Licensing System</b>: 1 Seat = 1 active team member. The company buys as many seats as they have employees needing training."),
        ("Step 4: Inviting Team Members", "Company administrators send email invitations to their staff. When an employee accepts, they automatically occupy one available seat and get access to the company's course catalog."),
        ("Step 5: Role & Access Management (RBAC)", "Company admins assign specific roles to team members to keep data secure and organized:")
    ]

    for title_str, desc_str in b2b_steps:
        story.append(Paragraph(f"• <b>{title_str}</b>: {desc_str}", bullet_style))

    story.append(Spacer(1, 6))

    # Role breakdown mini table
    role_data = [
        [Paragraph("<b>Company Role</b>", ParagraphStyle('RTH', parent=body_style, fontName='Helvetica-Bold')), Paragraph("<b>What They Can Access</b>", ParagraphStyle('RTH', parent=body_style, fontName='Helvetica-Bold'))],
        [Paragraph("<b>Company Admin</b>", body_style), Paragraph("Full control over billing, buying seats, adding/removing members, and configuring payment settings.", body_style)],
        [Paragraph("<b>Manager / Team Leader</b>", body_style), Paragraph("Views team completion rates, employee progress graphs, and skill gap reports (no access to billing).", body_style)],
        [Paragraph("<b>Instructor / Teacher</b>", body_style), Paragraph("Creates courses, builds quizzes and assessments, conducts live sessions, and issues certificates.", body_style)],
        [Paragraph("<b>Learner / Employee</b>", body_style), Paragraph("Focuses on learning — taking courses, completing quizzes, using the AI Coach, and earning badges.", body_style)]
    ]
    role_table = Table(role_data, colWidths=[150, 380])
    role_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(role_table)
    story.append(Spacer(1, 14))

    # SECTION 3: PAYMENT, BILLING & REVENUE FLOW
    story.append(Paragraph("3. Payment, Billing & How Instructors Earn Money", h1_style))
    story.append(Paragraph(
        "Train AI features a complete global financial engine powered by <b>Paystack</b> and <b>Stripe</b>. "
        "Here is how payments, billing, and revenue distribution work:",
        body_style
    ))

    story.append(Paragraph("A. Global Payment Processing (Paystack & Stripe)", h2_style))
    story.append(Paragraph(
        "To ensure seamless payments worldwide, Train AI automatically detects the customer's location and currency:",
        body_style
    ))

    pay_data = [
        [Paragraph("<b>Payment Provider</b>", ParagraphStyle('PTH', parent=body_style, fontName='Helvetica-Bold', textColor=colors.white)), Paragraph("<b>Currencies Supported</b>", ParagraphStyle('PTH', parent=body_style, fontName='Helvetica-Bold', textColor=colors.white)), Paragraph("<b>Payment Methods Accepted</b>", ParagraphStyle('PTH', parent=body_style, fontName='Helvetica-Bold', textColor=colors.white))],
        [Paragraph("<b>Paystack</b>", body_style), Paragraph("Nigerian Naira (₦), Ghanaian Cedi (GH₵), Kenyan Shilling (KSh), South African Rand (R)", body_style), Paragraph("Local Debit/Credit Cards, Direct Bank Transfers, USSD Code, Mobile Money", body_style)],
        [Paragraph("<b>Stripe</b>", body_style), Paragraph("US Dollars ($), British Pounds (£), Euros (€)", body_style), Paragraph("International Credit/Debit Cards (Visa, Mastercard, American Express), Apple Pay, Google Pay", body_style)]
    ]
    pay_table = Table(pay_data, colWidths=[110, 190, 230])
    pay_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SECONDARY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(pay_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("B. Test Mode vs. Live Production Mode", h2_style))
    story.append(Paragraph(
        "Companies can toggle between <b>Test Mode</b> (to safely test checkout flows with simulated test keys) and "
        "<b>Live Production Mode</b> (to collect actual payments). When Live Mode is selected, all charges process real funds immediately.",
        body_style
    ))

    story.append(Paragraph("C. How Instructors & Companies Make Money", h2_style))
    story.append(Paragraph(
        "Instructors and training organizations monetize their courses on Train AI through three straightforward methods:",
        body_style
    ))

    money_points = [
        ("1. Selling Paid Courses", "Instructors or companies create premium courses and set a price (e.g. $50 or ₦25,000). When an external learner buys the course, the payment is processed immediately."),
        ("2. Automatic Revenue Splitting", "Organizations can connect their own Paystack Subaccount Code or Stripe Account ID in Settings Hub. When a course is sold, Paystack/Stripe automatically splits the money: the platform's small commission is retained, and the instructor's majority share is deposited directly into their own bank account."),
        ("3. Direct Bank Settlement & Payout Requests", "For courses sold through central platform channels, earnings accumulate in the instructor's earnings balance. Instructors can request a direct bank payout anytime to receive funds in their verified bank account.")
    ]

    for m_title, m_desc in money_points:
        story.append(Paragraph(f"• <b>{m_title}</b>: {m_desc}", bullet_style))

    story.append(Spacer(1, 14))

    # SECTION 4: KEY FEATURES & DAILY WORKFLOWS
    story.append(Paragraph("4. Key Platform Features at a Glance", h1_style))

    features = [
        ("AI Neural Coach & Assistant", "Provides learners with 24/7 instant answers, explains difficult course topics, and generates personalized practice quizzes on demand."),
        ("Cohorts & Study Groups", "Allows learners to study in structured groups, discuss course material with peers, and collaborate with assigned instructors."),
        ("Verified Digital Certificates", "When a learner finishes a course and passes its final assessment, Train AI generates an official digital certificate complete with a unique verification code."),
        ("Workforce Skill Intelligence", "Gives business leaders clear visual dashboards showing employee completion progress, active learning hours, and company-wide skill strengths.")
    ]

    for f_title, f_desc in features:
        story.append(Paragraph(f"• <b>{f_title}</b>: {f_desc}", bullet_style))

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=5, spaceAfter=10))

    # Footer note
    footer_text = "<i>Train AI Platform Operational Guide — Built for simplicity, transparency, and enterprise-grade performance.</i>"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=body_style, fontSize=8.5, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)))

    doc.build(story)
    print(f"Successfully generated PDF at: {filename}")

if __name__ == "__main__":
    output_pdf = sys.argv[1] if len(sys.argv) > 1 else "Train_AI_Platform_Guide.pdf"
    create_pdf(output_pdf)
