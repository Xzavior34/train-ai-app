import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically add 'Page X of Y' and running headers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8.5)
        self.setFillColor(colors.HexColor("#64748B"))

        # Header (pages 2+)
        if self._pageNumber > 1:
            self.drawString(40, 755, "Train AI — Platform Operational & Workflow Guide")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(40, 748, 572, 748)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 45, 572, 45)

        self.drawString(40, 30, "Confidential — Built for Train AI Platform Operations")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(572, 30, page_str)
        self.restoreState()


def create_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=50,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()

    # Brand Color Palette
    PRIMARY = colors.HexColor("#0F172A")    # Deep Slate / Navy
    SECONDARY = colors.HexColor("#2563EB")  # Cobalt Blue
    ACCENT = colors.HexColor("#0D9488")     # Emerald Teal
    WARN_COLOR = colors.HexColor("#D97706") # Amber
    DARK_TEXT = colors.HexColor("#1E293B")  # Charcoal Text
    LIGHT_BG = colors.HexColor("#F8FAFC")   # Soft Off-White
    BORDER_COLOR = colors.HexColor("#E2E8F0")

    # Typography Styles
    doc_title_style = ParagraphStyle(
        'DocTitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=22, leading=26,
        textColor=PRIMARY, spaceAfter=4
    )

    doc_subtitle_style = ParagraphStyle(
        'DocSubTitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=12, leading=16,
        textColor=SECONDARY, spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=14, leading=18,
        textColor=PRIMARY, spaceBefore=14, spaceAfter=8
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=11.5, leading=15,
        textColor=SECONDARY, spaceBefore=10, spaceAfter=6
    )

    body_style = ParagraphStyle(
        'Body_Custom', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9.5, leading=14,
        textColor=DARK_TEXT, spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom', parent=body_style,
        leftIndent=14, firstLineIndent=-9, spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'CalloutText', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=13.5,
        textColor=DARK_TEXT
    )

    th_style = ParagraphStyle('TH', parent=body_style, fontName='Helvetica-Bold', textColor=colors.white)

    story = []

    # Document Header Banner
    story.append(Paragraph("Train AI — Master Operational & Workflow Guide", doc_title_style))
    story.append(Paragraph("A Complete Non-Technical Walkthrough of User Invitations, Course Delivery, Payments, Billing &amp; Revenue Splits", doc_subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=SECONDARY, spaceBefore=0, spaceAfter=12))

    # Executive Overview Box
    summary_text = (
        "<b>Executive Overview:</b> This document provides a complete, easy-to-understand breakdown of every key process in Train AI. "
        "It covers <b>User Onboarding &amp; Invitations</b>, <b>Instructor &amp; Course Publishing</b>, <b>Payment Execution (Paystack &amp; Stripe)</b>, "
        "<b>Subscription Billing &amp; Seat Licenses</b>, and <b>Revenue Split Percentages &amp; Bank Payouts</b> — with zero technical developer jargon."
    )
    summary_table = Table([[Paragraph(summary_text, callout_style)]], colWidths=[532])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, SECONDARY),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # SECTION 1: WORKSPACE ARCHITECTURE
    story.append(Paragraph("1. Platform Workspaces & User Roles", h1_style))
    story.append(Paragraph(
        "Train AI organizes users into three clean, dedicated workspaces:",
        body_style
    ))

    ws_data = [
        [Paragraph("<b>Workspace</b>", th_style), Paragraph("<b>Target Users</b>", th_style), Paragraph("<b>Core Functions</b>", th_style)],
        [
            Paragraph("<b>Learner Experience</b>", body_style),
            Paragraph("Employees, Students, Independent Learners", body_style),
            Paragraph("Enroll in courses, take quizzes, chat with the AI Coach, track personal skills, join study groups, and earn verified certificates.", body_style)
        ],
        [
            Paragraph("<b>Organization Hub</b>", body_style),
            Paragraph("Company Executives, Admins, Managers, Instructors", body_style),
            Paragraph("Invite employees, manage seats, assign courses, build quizzes, track workforce analytics, set payment gateways, and configure permissions.", body_style)
        ],
        [
            Paragraph("<b>Platform Owner Portal</b>", body_style),
            Paragraph("Central Train AI Operators", body_style),
            Paragraph("Monitor overall system health, manage enterprise pricing plans, set platform commission rates, and track global transactions.", body_style)
        ]
    ]
    ws_table = Table(ws_data, colWidths=[120, 140, 272])
    ws_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(ws_table)
    story.append(Spacer(1, 10))

    # SECTION 2: USER INVITATION & B2B ONBOARDING FLOW
    story.append(Paragraph("2. The User Invitation & B2B Onboarding Flow", h1_style))
    story.append(Paragraph(
        "How a business signs up and adds employees to their company workspace step-by-step:",
        body_style
    ))

    invite_steps = [
        ("1. Company Sign Up", "A company executive creates the organization account on Train AI and inputs company details."),
        ("2. Purchasing Learner Seats", "The company purchases a bundle of <b>User Seats</b> (e.g. 50 seats). Each seat allows 1 employee to access the platform."),
        ("3. Sending Email Invitations", "The Company Admin enters employee email addresses in <i>People &amp; Access</i> and selects their role (Manager, Instructor, or Learner)."),
        ("4. Employee Acceptance", "The employee receives an official email invitation link. Clicking the link takes them to sign in or create their password."),
        ("5. Seat Deduction & Role Assignment", "Once accepted, 1 seat is automatically deducted from the company's available seat balance, and the employee is routed straight into their assigned workspace."),
        ("6. Role & Permission Control (RBAC)", "Company Admins can adjust permissions anytime (e.g. allowing Instructors to issue certificates or create assessments).")
    ]

    for step_title, step_desc in invite_steps:
        story.append(Paragraph(f"• <b>{step_title}</b>: {step_desc}", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 3: INSTRUCTOR & COURSES FLOW
    story.append(Paragraph("3. The Instructor & Course Publishing Flow", h1_style))
    story.append(Paragraph(
        "How instructors build courses, deliver training, evaluate learners, and issue certificates:",
        body_style
    ))

    course_steps = [
        ("1. Instructor Profile Setup", "Instructors set up their professional bio, teaching specializations, and portfolio in <i>Instructor Settings</i>."),
        ("2. Course Creation & Builder", "Instructors use the <i>Course Builder</i> to create structured courses with titles, descriptions, categories, video/text lessons, and attachments."),
        ("3. Quiz & Assessment Builder", "Instructors add multiple-choice practice quizzes and final course assessments with marked correct answers and point values."),
        ("4. Course Publishing & Access", "Courses can be published as <b>Free</b> (for all company staff), <b>Assigned</b> (mandatory for specific cohorts), or <b>Paid</b> (priced for external sale)."),
        ("5. Cohorts & Student Engagement", "Instructors facilitate study cohorts, answer learner questions, and run discussion topics."),
        ("6. Automatic & Direct Certificate Issuance", "When a learner passes the final course assessment, Train AI automatically generates a verified digital certificate. Instructors can also directly grant certificates to deserving students.")
    ]

    for c_title, c_desc in course_steps:
        story.append(Paragraph(f"• <b>{c_title}</b>: {c_desc}", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 4: PAYMENT EXECUTION FLOW
    story.append(Paragraph("4. The Payment Execution Flow (Paystack & Stripe)", h1_style))
    story.append(Paragraph(
        "How transactions are securely initiated, processed, and confirmed end-to-end:",
        body_style
    ))

    pay_steps = [
        ("1. Automatic Location & Currency Detection", "Train AI automatically detects the user's location and displays prices in their local currency (Naira ₦, US Dollars $, Pounds £, Euros €, Cedi GH₵, Shillings KSh, Rand R)."),
        ("2. Provider Checkout Redirection", "When a customer clicks <i>Buy Course</i>, <i>Upgrade Plan</i>, or <i>Purchase Seats</i>, the platform seamlessly connects to <b>Paystack</b> (African payments) or <b>Stripe</b> (International payments) hosted checkout pages."),
        ("3. Real-Time Secure Verification", "Once payment is completed on Paystack or Stripe, the gateway redirects back to Train AI. The platform runs a double-check verification to confirm exact payment amount and transaction reference."),
        ("4. Automated Fulfillment & Receipts", "Upon confirmation, the service immediately unlocks the purchased item (enrolling the student, adding seats, or upgrading the plan) and issues a receipt.")
    ]

    for p_title, p_desc in pay_steps:
        story.append(Paragraph(f"• <b>{p_title}</b>: {p_desc}", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 5: BILLING & SEAT LICENSING FLOW
    story.append(Paragraph("5. Billing, Subscriptions & Seat Licensing Flow", h1_style))
    story.append(Paragraph(
        "How companies manage subscription plans, user seat licenses, and AI credits:",
        body_style
    ))

    bill_data = [
        [Paragraph("<b>Billing Item</b>", th_style), Paragraph("<b>How It Works</b>", th_style), Paragraph("<b>Billing Frequency</b>", th_style)],
        [
            Paragraph("<b>Starter Subscription</b>", body_style),
            Paragraph("Unlocks core company features, course builder, up to 100 learner accounts, and 10 AI credits per user.", body_style),
            Paragraph("Monthly or Annual Renewal", body_style)
        ],
        [
            Paragraph("<b>Growth Subscription</b>", body_style),
            Paragraph("Unlocks advanced workforce skill graphs, manager dashboards, custom branding, and up to 500 learner accounts.", body_style),
            Paragraph("Monthly or Annual Renewal", body_style)
        ],
        [
            Paragraph("<b>User Seat Packages</b>", body_style),
            Paragraph("Companies buy additional seat licenses as their team grows. Unused seats remain available in company inventory.", body_style),
            Paragraph("One-time or Pay-as-you-grow", body_style)
        ],
        [
            Paragraph("<b>AI Credit Top-Ups</b>", body_style),
            Paragraph("Companies buy extra credit packages to give their learners more AI Coach interactions and quiz generations.", body_style),
            Paragraph("On-demand Top-up", body_style)
        ]
    ]
    bill_table = Table(bill_data, colWidths=[130, 272, 130])
    bill_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SECONDARY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 10))

    # SECTION 6: PERCENTAGE, REVENUE SPLIT & PAYOUT FLOW
    story.append(Paragraph("6. Percentage Revenue Split & Payout Flow", h1_style))
    story.append(Paragraph(
        "How money earned from course sales is automatically split and deposited into bank accounts:",
        body_style
    ))

    split_steps = [
        ("1. Course Sale Initiated", "A learner purchases a paid course created by an instructor or training organization."),
        ("2. Platform Commission Split", "Train AI applies a standard platform fee percentage (e.g. 15% platform commission, 85% instructor payout)."),
        ("3. Automated Gateway Subaccount Split (Paystack/Stripe)", "If the organization has connected their <b>Paystack Subaccount</b> or <b>Stripe Connected Account ID</b> in <i>Settings Hub</i>, Paystack/Stripe automatically splits the money at checkout: Train AI receives the platform fee, and the remaining majority is deposited directly into the organization's connected bank account."),
        ("4. Direct Bank Settlement for Central Sales", "For sales collected centrally, earnings accumulate in the instructor's earnings dashboard. Instructors can request a direct bank payout to receive funds into their local bank account."),
        ("5. Complete Financial Tracking", "Both Platform Owners and Company Admins have transparent revenue reports showing total sales, gross income, platform fees, and net payouts.")
    ]

    for s_title, s_desc in split_steps:
        story.append(Paragraph(f"• <b>{s_title}</b>: {s_desc}", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 7: AI ASSISTANT & COMMUNITY FLOW
    story.append(Paragraph("7. AI Assistant, Credits & Community Flow", h1_style))

    ai_community_points = [
        ("AI Neural Coach & Credit Consumption", "Learners ask questions or generate practice quizzes using the AI Coach. Each interaction uses 1 AI credit. Admins can top up credit balances or set custom manual auto-reply messages."),
        ("Cohorts & Collaborative Study Groups", "Learners join study cohorts led by instructors. They can chat, share study notes, and track progress together in privacy-safe group channels."),
        ("Gamification & Leaderboard Control", "Learners earn experience points (XP), maintain daily learning streaks, and unlock achievement badges. Company Admins can toggle leaderboard rankings on or off in Access Control.")
    ]

    for a_title, a_desc in ai_community_points:
        story.append(Paragraph(f"• <b>{a_title}</b>: {a_desc}", bullet_style))

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=4, spaceAfter=8))

    footer_note = "<i>Train AI Operational Guide — Designed for complete operational clarity, secure financial flows, and enterprise scaling.</i>"
    story.append(Paragraph(footer_note, ParagraphStyle('EndNote', parent=body_style, fontSize=8.5, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated Master PDF Guide at: {filename}")

if __name__ == "__main__":
    output_pdf = sys.argv[1] if len(sys.argv) > 1 else "Train_AI_Platform_Guide.pdf"
    create_pdf(output_pdf)
