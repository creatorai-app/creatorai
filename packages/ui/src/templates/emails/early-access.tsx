import React from 'react';

interface EarlyAccessEmailProps {
  email?: string;
}

/**
 * 
 * @todo Add this template later on
 */

const EarlyAccessEmail = () => {
  return (
    <div className="font-sans bg-gray-100 p-6 max-w-lg mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 p-6 text-center">
          <h1 className="text-white text-2xl font-bold">Creator AI Waitlist</h1>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-800 text-base mb-4">
            Hey there!
          </p>
          <p className="text-gray-800 text-base mb-4">
            Thanks for joining the Creator AI early access waitlist! We're excited to have you.
          </p>
          <p className="text-gray-800 text-base mb-4">
            We'll email you once your access is ready. Get ready to create amazing content with Creator AI!
          </p>
          <a
            href="https://v0-script-ai-app.vercel.app/"
            target='_blank'
            className="inline-block bg-purple-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-purple-700"
          >
            Visit Creator AI
          </a>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-200">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Creator AI. All rights reserved.
          </p>
          <p className="text-gray-600 text-sm">
            Questions? Reach out to us at{' '}
            <a href="mailto:support@tryscriptai.com" className="text-purple-600 hover:underline">
              support@tryscriptai.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EarlyAccessEmail;