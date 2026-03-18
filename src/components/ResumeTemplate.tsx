import React from 'react';
import ReactMarkdown from 'react-markdown';

interface ResumeTemplateProps {
  content: string;
  template: string;
  name: string;
  jobTitle?: string;
  email: string;
  photoUrl?: string;
  personalLink?: string;
  includePersonalLink?: boolean;
}

export const ResumeTemplate: React.FC<ResumeTemplateProps> = ({
  content,
  template,
  name,
  jobTitle,
  email,
  photoUrl,
  personalLink,
  includePersonalLink
}) => {
  const isSidebarLayout = [
    'modern', 
    'creative', 
    'professional-sidebar', 
    'clean-sidebar', 
    'dark-sidebar', 
    'teal-accent', 
    'red-sidebar', 
    'beige-sidebar',
    'geometric'
  ].includes(template);
  
  const getLayoutClass = () => {
    if (isSidebarLayout) return 'sidebar-layout';
    return 'standard-layout';
  };

  const getTemplateSpecificClass = () => {
    return `template-${template}`;
  };

  return (
    <div className={`resume-preview-container bg-white shadow-lg mx-auto w-full min-h-[1000px] overflow-hidden ${getTemplateSpecificClass()}`} dir="rtl">
      <div className={`resume-layout ${getLayoutClass()}`}>
        {/* Sidebar Section */}
        <div className="resume-sidebar">
          {photoUrl && (
            <div className="resume-photo-container">
              <img src={photoUrl} alt="" className="resume-photo" referrerPolicy="no-referrer" />
            </div>
          )}
          <div className="resume-header">
            <h1 className="resume-name">{name}</h1>
            {jobTitle && <div className="resume-title">{jobTitle}</div>}
          </div>
          <div className="resume-contact">
            <div className="contact-item">📧 {email}</div>
            {includePersonalLink && personalLink && (
              <div className="personal-link-box">
                <span className="personal-link-label">לינק אישי:</span>
                <span className="personal-link-url">{personalLink.replace('https://', '')}</span>
              </div>
            )}
          </div>
          
          {/* Some templates might have extra sidebar content or decorations */}
          {template === 'geometric' && (
            <div className="geometric-decoration">
              <div className="geo-shape-1"></div>
              <div className="geo-shape-2"></div>
            </div>
          )}
        </div>

        {/* Main Section */}
        <div className="resume-main">
          {!isSidebarLayout && (
            <div className="resume-header-standard">
              {photoUrl && (
                <div className="resume-photo-container">
                  <img src={photoUrl} alt="" className="resume-photo" referrerPolicy="no-referrer" />
                </div>
              )}
              <h1 className="resume-name">{name}</h1>
              {jobTitle && <div className="resume-title">{jobTitle}</div>}
              <div className="resume-contact-standard">
                <span>📧 {email}</span>
                {includePersonalLink && personalLink && (
                  <span>🔗 {personalLink.replace('https://', '')}</span>
                )}
              </div>
            </div>
          )}
          
          {/* Special Header for some standard layouts */}
          {template === 'bordered-header' && (
             <div className="bordered-header-accent"></div>
          )}

          <div className="resume-content-body prose prose-sm prose-slate max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};
